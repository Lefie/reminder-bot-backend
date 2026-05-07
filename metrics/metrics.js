import { client as db} from "../db.js"
import { secureQuery } from "../utils.js"


/**
 * over all stats 
 */

async function notification_delivery_stats() {

    const overallStats = await secureQuery(`select count(*) as total_sent,
count(*) filter (where status = 'success') as successful,
count(*) filter (where status = 'failed') as failed,
round(count(*) filter (where status = 'success') :: numeric / count(*) * 100) as success_rate_percent from notification_logs;
    `)

    const errorBreakdown = await secureQuery(`
            SELECT 
                error_message as error_type,
                COUNT(*) as count
            FROM notification_logs
            WHERE status = 'failed'
            GROUP BY error_message
            ORDER BY count DESC
        `)
    
    const dailyVolume = await secureQuery(`
            SELECT 
                DATE(sent_at) as date,
                COUNT(*) as notifications_sent,
                COUNT(*) FILTER (WHERE status = 'success') as successful
            FROM notification_logs
            WHERE sent_at >= CURRENT_DATE - INTERVAL '30 days'
            GROUP BY DATE(sent_at)
            ORDER BY date DESC
        `)
    
    const timeRange = await secureQuery(`
            SELECT 
                MIN(sent_at) as first_notification,
                MAX(sent_at) as last_notification,
                AGE(MAX(sent_at), MIN(sent_at)) as tracking_duration
            FROM notification_logs
        `)

    
    let overallStatsRes = overallStats ? overallStats.rows : []
    let errorBreakdownRes = errorBreakdown ? errorBreakdown.rows : []
    let dailyVolumeRes = dailyVolume ? dailyVolume.rows : [] // in the future, if we want to map out / visualize the data in the frontend
    let timeRangeRes = timeRange ? timeRange.rows : []
    console.log(errorBreakdownRes)

    const summary = `
    ##################################################################
    Analysis
    ##################################################################
    Time Range
    month(s): ${timeRangeRes.length > 0 ? timeRangeRes[0]["tracking_duration"]["months"]: ""}
    day(s): ${timeRangeRes.length > 0 ? timeRangeRes[0]["tracking_duration"]["days"]: ""}
    first notification from range : ${timeRangeRes.length > 0 ? timeRangeRes[0]["first_notification"].toISOString().split("T")[0]: ""}
    last notification from range: ${timeRangeRes.length > 0 ? timeRangeRes[0]["last_notification"].toISOString().split("T")[0]: ""}

    ##################################################################
    Overall Notification Delivery : 
        * Total Notifications Sent: ${overallStatsRes ? overallStatsRes[0]["total_sent"]: ""}
        * Succesful Delivery: ${overallStatsRes ? overallStatsRes[0]["successful"]: ""}
        * Failed Delivery: ${overallStatsRes ? overallStatsRes[0]["failed"]: ""}
        * Successful Rate : ${overallStatsRes ? overallStatsRes[0]["success_rate_percent"]: ""} %
    
    ##################################################################
    Errors:
    ${errorBreakdownRes
  .map(error => `    ${error.error_type}: ${error.count}`)
  .join('\n')}

    `

    const summaryDataObj = {
        overallStats : overallStatsRes,
        errorBreakdownStats: errorBreakdownRes,
        dailyVolumeStats: dailyVolumeRes,
        timeRangeStats: timeRangeRes
    }

    return summaryDataObj
}

async function reminders_usage_stats() {

    const recurringStats = await secureQuery(`
            SELECT 
                COUNT(*) as total_reminders,
                COUNT(*) FILTER (WHERE isrecurring = true) as recurring_count,
                COUNT(*) FILTER (WHERE isrecurring = false) as one_time_count,
                ROUND(
                    COUNT(*) FILTER (WHERE isrecurring = true)::NUMERIC / 
                    COUNT(*) * 100, 
                    1
                ) as recurring_percent
            FROM reminder
        `)
    
    const recurringTypes = await secureQuery(`
            SELECT 
                recurringtype,
                COUNT(*) as count,
                ROUND(
                    COUNT(*)::NUMERIC / 
                    (SELECT COUNT(*) FROM reminder WHERE isrecurring = true) * 100,
                    1
                ) as percentage
            FROM reminder
            WHERE isrecurring = true
            GROUP BY recurringtype
            ORDER BY count DESC
        `)
    
    const timePatterns = await secureQuery(`
            SELECT 
                EXTRACT(HOUR FROM event_from) as hour,
                COUNT(*) as count
            FROM reminder
            WHERE event_from IS NOT NULL
            GROUP BY EXTRACT(HOUR FROM event_from)
            ORDER BY hour ASC
        `)
    
    const morningCount = await secureQuery(`
            SELECT COUNT(*) as count
            FROM reminder
            WHERE EXTRACT(HOUR FROM event_from) >= 6 
              AND EXTRACT(HOUR FROM event_from) < 12
        `)
    
    const afternoonCount = await secureQuery(`
        SELECT COUNT(*) as count
        FROM reminder
        WHERE EXTRACT(HOUR FROM event_from) >= 12
            AND EXTRACT(HOUR FROM event_from) < 18
    `)

    const nightCount = await secureQuery(`
        SELECT COUNT(*) as count
        FROM reminder
        WHERE EXTRACT(HOUR FROM event_from) >= 18
            AND EXTRACT(HOUR FROM event_from) < 0
    `)
    

    
    
    const dateRange = await secureQuery(`
            SELECT 
                MIN(reminder_date) as earliest_reminder,
                MAX(reminder_date) as latest_reminder,
                AGE(MAX(reminder_date), MIN(reminder_date)) as span
            FROM reminder
        `)
    
    let recurringStatsRes = recurringStats.rows
    let recurringTypesRes = recurringTypes.rows
    let timePatternsRes = timePatterns.rows
    let morningCountRes = morningCount.rows
    let afternoonCountRes = afternoonCount.rows
    let nightCountRes = nightCount.rows
    let dateRangeRes = dateRange.rows

    console.log(recurringStatsRes)

    const summaryReport = `
    ##################################################################
    Reminders Usage Stats
    ##################################################################
    Basic Stats:
    * Total reminders: ${recurringStatsRes[0] ? recurringStatsRes[0]["total_reminders"]:""}
    * Reccuring reminders: ${recurringStatsRes[0] ? recurringStatsRes[0]["recurring_count"]:""}
    * One-time reminders: ${recurringStatsRes[0] ? recurringStatsRes[0]["one_time_count"]:""}
    * Reccuring reminders percent: ${recurringStatsRes[0] ? recurringStatsRes[0]["recurring_percent"]:""}
    ##################################################################
    Recurring Analysis:
    Recurring Type:     Count
    ${recurringTypesRes[0]["recurringtype"]}              ${recurringTypesRes[0]["count"]}   
    ${recurringTypesRes[1]["recurringtype"]}              ${recurringTypesRes[1]["count"]} 
    ${recurringTypesRes[2]["recurringtype"]}                ${recurringTypesRes[2]["count"]}      
    ##################################################################
    Time Pattern: 
    Count the reminders scheduled between 6am and 12 pm: ${morningCountRes[0]["count"]}
    Count the reminders scheduled between 12pm and 6 pm: ${afternoonCountRes[0]["count"]}
    Count the reminders scheduled between 6pm and 12 am: ${nightCountRes[0]["count"]}
    ##################################################################
    Date Range:
    Earliest Reminder: ${dateRangeRes[0]["earliest_reminder"].toISOString().split("T")[0]}
    Latest Reminder: ${dateRangeRes[0]["latest_reminder"].toISOString().split("T")[0]}
    Duration: ${dateRangeRes[0]["span"]["months"]} months ${dateRangeRes[0]["span"]["days"]} days 
    `

    console.log(summaryReport)

    const dataObj = {
        summary: {
            total_reminders: parseInt(recurringStatsRes[0]["total_reminders"]),
            recurring_reminders: parseInt(recurringStatsRes[0]["recurring_count"]),
            one_time_reminders: parseInt(recurringStatsRes[0]["one_time_count"]),
            recurring_reminders_percent: parseInt(recurringStatsRes[0]["recurring_percent"])
        },
        recurring_types_stats: {
            weekly: parseInt(recurringTypesRes[0]["count"]),
            monthly: parseInt(recurringTypesRes[1]["count"]),
            daily: parseInt(recurringTypesRes[2]["count"]),
        },
        schedule_time_pattern: {
            reminders_morning: parseInt(morningCountRes[0]["count"]),
            reminders_afternoon: parseInt(afternoonCountRes[0]["count"]),
            reminders_night: parseInt(nightCountRes[0]["count"])
        },
        date_range: {
            earliest_reminder: dateRangeRes[0]["earliest_reminder"],
            latest_reminder: dateRangeRes[0]["latest_reminder"],
            span: dateRangeRes[0]["span"]
        }

    }

    return dataObj
}

async function dbPerformanceTest() {

    // Test1: how fast can we get the upcoming reminders?
    const start1 = Date.now()
    await secureQuery(`
        SELECT * FROM reminder 
        WHERE reminder_date >= CURRENT_DATE 
        ORDER BY reminder_date ASC 
        LIMIT 50
    `)
    const end1 = Date.now()
    const duration1 = end1 - start1 

    // Test2: how fast can we get the recurring reminders?
    const start2 = Date.now()
    await secureQuery(`
        SELECT * FROM reminder 
        WHERE isrecurring = true
    `)
    const end2 = Date.now()
    const duration2 = end2 - start2

    // Test3: how fast can we get notification history from the last 30 days?
    const start3 = Date.now()
    await secureQuery(`
        SELECT * FROM notification_logs 
        WHERE sent_at >= CURRENT_DATE - INTERVAL '30 days'
    `)
    const end3 = Date.now()
    const duration3 = end3 - start3

    const indexes = await secureQuery(`
        SELECT 
            tablename,
            indexname
        FROM pg_indexes
        WHERE tablename IN ('reminder', 'notification_logs')
          AND schemaname = 'public'
        ORDER BY tablename, indexname
    `)

    const indexCount = indexes.rows.length

    const reminderCount = await secureQuery('SELECT COUNT(*) as count FROM reminder')
    const notificationCount = await secureQuery('SELECT COUNT(*) as count FROM notification_logs')
    
    const summaryReport = `
    ##################################################################
    Database Performance Stats
    ##################################################################
    
    Query Speed Tests:
    * Get upcoming reminders:     ${duration1} ms
    * Get recurring reminders:    ${duration2} ms
    * Get notification history:   ${duration3} ms
    
    Average query time: ${Math.round((duration1 + duration2 + duration3) / 3)} ms
    
    ##################################################################
    Database Info:
    * Total reminders:            ${reminderCount.rows[0].count}
    * Total notification logs:    ${notificationCount.rows[0].count}
    * Indexes created:            ${indexCount}
    
    ##################################################################
    `
    
    console.log(summaryReport)
    

    const dataObj = {
        query_times: {
            date_range_ms: duration1,
            recurring_filter_ms: duration2,
            notification_history_ms: duration3,
            average_ms: Math.round((duration1 + duration2 + duration3) / 3)
        },
        database_info: {
            reminder_count: parseInt(reminderCount.rows[0].count),
            notification_log_count: parseInt(notificationCount.rows[0].count),
            index_count: indexCount
        }
    }

    return dataObj
}


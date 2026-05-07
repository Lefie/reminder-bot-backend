import { client as db } from "../db.js"
import "dotenv/config"


function getRandomDate() {
    const days_offset = Math.floor(Math.random() *  90 ) - 30 // min:-30  max: 90 
    const date = new Date()
    date.setDate(date.getDate() - days_offset)
    const dateString = date.toISOString().split("T")[0]
    return dateString
}

async function seedReminders(){
    console.log("reminder data ")

    const reminderTemplates = [
        { name: "Team standup meeting", from: "09:00", to: "09:30", recurring: true, type: "daily" },
        { name: "Weekly 1-on-1 with manager", from: "14:00", to: "14:30", recurring: true, type: "weekly", day_of_week: "2" },
        { name: "Sprint planning", from: "10:00", to: "11:00", recurring: true, type: "weekly", day_of_week: "1" },
        { name: "Code review session", from: "15:00", to: "16:00", recurring: true, type: "weekly", day_of_week: "3" },
        { name: "Project deadline check", from: "16:00", to: "16:30", recurring: true, type: "weekly", day_of_week: "5" },
        
        // Personal recurring
        { name: "Gym workout", from: "07:00", to: "08:00", recurring: true, type: "daily" },
        { name: "Grocery shopping", from: "18:00", to: "19:00", recurring: true, type: "weekly", day_of_week: "6" },
        { name: "Meal prep Sunday", from: "10:00", to: "12:00", recurring: true, type: "weekly", day_of_week: "7" },
        { name: "Call parents", from: "19:00", to: "19:30", recurring: true, type: "weekly", day_of_week: "7" },
        { name: "Pay rent", from: "09:00", to: "09:15", recurring: true, type: "monthly", day_of_month: "1" },
        { name: "Review budget", from: "20:00", to: "20:30", recurring: true, type: "monthly", day_of_month: "15" },
        
        // One-time reminders
        { name: "Doctor appointment", from: "14:00", to: "15:00", recurring: false, type: "none" },
        { name: "Car maintenance", from: "10:00", to: "11:00", recurring: false, type: "none" },
        { name: "Submit expense report", from: "16:00", to: "16:30", recurring: false, type: "none" },
        { name: "Birthday party prep", from: "15:00", to: "17:00", recurring: false, type: "none" },
        { name: "Dentist checkup", from: "13:00", to: "14:00", recurring: false, type: "none" },
    ]

    const targetCount = 50
    let reminderCount = 0

    while (reminderCount < targetCount) {
        const template_choice = reminderTemplates[Math.floor(Math.random() * reminderTemplates.length)]
        const reminder = {
            event_name : template_choice["name"],
            event_from : template_choice["from"],
            event_to: template_choice["to"],
            reminder_date: getRandomDate(),
            isrecurring: template_choice["recurring"],
            recurringtype: template_choice["type"],
            day_of_week: template_choice["day_of_week"] ? template_choice["day_of_week"] : "",
            day_of_month: template_choice["day_of_month"] ? template_choice["day_of_month"] : ""
        }

        // db query 
        const query = `INSERT INTO reminder (event_name, event_from, event_to, reminder_date, isrecurring, recurringtype, day_of_week, day_of_month) 
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`
        const values = [reminder.event_name, reminder.event_from, reminder.event_to, reminder.reminder_date, reminder.isrecurring, reminder.recurringtype, reminder.day_of_week, reminder.day_of_month]
        
        // console.log(query, values)
        // reminders.push(reminder)

        try {
            await db.query(query, values)
        }catch(error) {
            console.log("An error occurred", error)
        }

        reminderCount ++

    }


}



async function seedNotificationLogs() {
    // get a reasonable amount of reminders from db to create logs 
    const query = `SELECT reminder_id, event_name, reminder_date 
                   FROM reminder 
                   WHERE reminder_date < CURRENT_DATE
                   ORDER BY reminder_date ASC
                   LIMIT 150`
    const reminders = await db.query(query)
    const reminders_arr = reminders.rows



    if (reminders_arr.length == 0) {
        console.log("no reminders to create logs for...")
        return 
    }

    console.log(`${reminders_arr.length} past reminders to create log with`)
   
    let logs_created = 0

    for (const reminder of reminders_arr) {
        let sent_at = reminder.reminder_date
        sent_at.setHours(-4,10,0,0)
        console.log("sent at", sent_at)

        const isSuccess = Math.random() < 0.98
        const status = isSuccess ? "success" : "failed"

        const possibleErrors = [
            'Discord API rate limit exceeded',
            'Network timeout after 5000ms',
            'Webhook URL returned 404',
            'Connection refused - Discord servers unreachable',
            'Invalid webhook token'
        ]

        const errorMessage = isSuccess ? null : possibleErrors[Math.floor(Math.random() * possibleErrors.length)]


        try {
            await db.query(
                `INSERT INTO notification_logs (
                    reminder_id, 
                    reminder_name, 
                    notification_type,
                    status, 
                    sent_at, 
                    error_message
                ) VALUES ($1, $2, $3, $4, $5, $6)`,
                [
                    reminder.reminder_id,
                    reminder.event_name,
                    'discord',
                    status,
                    sent_at.toISOString(),  
                    errorMessage
                ]
            )
            
            logs_created++
            
            
            
        } catch(error) {
            console.error(`   Error inserting log for reminder ${reminder.reminder_id}:`, error.message)
        }
        

    }
  
}




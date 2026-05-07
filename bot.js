import 'dotenv/config'
// Require the necessary discord.js classes
import { Client, Events, GatewayIntentBits } from 'discord.js';
import schedule from "node-schedule";
import { client as db} from './db.js'
import { createTable, getRemindersTodayArray, changeData, getFutureDate, secureQuery } from './utils.js'

if(db){
    console.log("db is connected")
    await createTable()
}

const rule = new schedule.RecurrenceRule();
rule.hour = 0;
rule.minute = 10;
rule.tz = 'America/New_York';



// Create a new discord client instance
const client = new Client({ intents: [GatewayIntentBits.Guilds] });

// When the client is ready, run this code (only once).
// It makes some properties non-nullable.
client.once(Events.ClientReady, readyClient => {
	console.log(`Ready! Logged in as ${readyClient.user.tag}`);
    console.log(readyClient.isReady())
    console.log(`ready client token:${readyClient.readyAt}`)
});

async function logNotification(reminderId, reminderName, status, errorMessage = null) {
    try {
        await secureQuery(
            `INSERT INTO notification_logs (
                reminder_id, 
                reminder_name, 
                status, 
                error_message
            ) VALUES ($1, $2, $3, $4)`,
            [reminderId, reminderName, status, errorMessage]
        )
        
        console.log(` Logged notification: ${reminderName} - ${status}`)
        
    } catch(error) {
        
        console.log(`Failed to log notification for ${reminderName}:`, error.message)
    }
}

async function sendNotificationWithLogging(channel, message, reminder) {
    try {
        
        await channel.send(message)
        
        await logNotification(
            reminder.reminder_id,
            reminder.event_name,
            'success'
        )
        
        console.log(`Sent: ${reminder.event_name}`)
        return true
        
    } catch(error) {
        
        await logNotification(
            reminder.reminder_id,
            reminder.event_name,
            'failed',
            error.message  // Store the error message
        )
        
        console.log(`Failed to send ${reminder.event_name}:`, error.message)
        return false
    }
}

client.on('ready', () => {
    console.log(`Logged in as ${client.user.tag}!`);
    
    // Get a channel by ID and send a message
    const channel = client.channels.cache.get(process.env.DISCORD_CHANNEL_ID); 

    if( !channel) {
        console.log("channel not found")
        return
    }

    schedule.scheduleJob(rule, async()=>{ 
        // scan the database daily to check for upcoming reminders for the day
        // store all events in an array, [] 
        const reminders = await getRemindersTodayArray()
        console.log("results are below : ")
        console.log(reminders)
        // send out the reminders to the channel 
        console.log("reminders for ")
        const today = new Date();
        const todayDate = today.toDateString();
        channel.send(`Reminders for ${todayDate}`)

        if(reminders.length!== 0){
            let successCount = 0
            let failCount = 0

            for (const reminder of reminders) {
                console.log(reminder.event_name)
                const {event_name, event_from, event_to} = reminder
                const message = `${event_name}: ${event_from? event_from:''} ${event_to?event_to:''}`
                const success = await sendNotificationWithLogging(channel, message, reminder )
                if (success) {
                    successCount ++
                }
                else {
                    failCount ++
                }
               
            }

            
        }else{
            channel.send(`no reminders today!`)
        }
        
        //post processing 
        // alter the isreminded property of each event to be true
        // decide if we delete reminders or update the reminder date 
        //process_reminders(reminders)
        reminders.forEach( async(reminder)=>{
            console.log(reminder)
            if (reminder.recurringtype == "none") {
                const text = `delete from reminder where reminder_id = $1`
                await secureQuery(text,[reminder.reminder_id])
                console.log(`reminder at id ${reminder.reminder_id} is deleted`)
            }else {
                const d = new Date(reminder.reminder_date)
                const new_date = reminder.recurringtype === "weekly" ?  getFutureDate("weekly", d, parseInt(reminder.day_of_week)) 
                                        : reminder.recurringtype === "monthly" ?  getFutureDate("monthly", d, parseInt(reminder.day_of_month))
                                        :  getFutureDate("daily", d) 
                
                
                console.log("new date: ",new_date)
                const text = `update reminder set reminder_date = $1 where reminder_id = $2;`
                const values = [new_date, reminder.reminder_id]
                await secureQuery(text, values)
                console.log("value updated!")
            }
        })
    })
});

// Log in to Discord with your client's token
client.login(process.env.DISCORD_TOKEN);

export {client}
import 'dotenv/config'
// Require the necessary discord.js classes
import { Client, Events, GatewayIntentBits } from 'discord.js';
import schedule from "node-schedule";
import { client as db} from './db.js'
import { createTable, getRemindersTodayArray, changeData, getFutureDate } from './utils.js'

if(db){
    console.log("db is connected")
    await createTable()
}



// Create a new discord client instance
const client = new Client({ intents: [GatewayIntentBits.Guilds] });

// When the client is ready, run this code (only once).
// It makes some properties non-nullable.
client.once(Events.ClientReady, readyClient => {
	console.log(`Ready! Logged in as ${readyClient.user.tag}`);
    console.log(readyClient.isReady())
    console.log(`ready client token:${readyClient.readyAt}`)
});

client.on('ready', () => {
    console.log(`Logged in as ${client.user.tag}!`);
    
    // Get a channel by ID and send a message
    const channel = client.channels.cache.get(process.env.DISCORD_CHANNEL_ID); 

    if( !channel) {
        console.log("channel not found")
        return
    }

    schedule.scheduleJob('11 * * * *', async()=>{ 
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
            reminders.forEach((r) => {
                console.log(r.event_name)
                const {event_name, event_from, event_to} = r
                const title = `${event_name}: ${event_from?event_from:''} ${event_to?event_to:''}`
                channel.send(`${title}`)
            })
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
                const text = `delete from reminder where reminder_id = ${reminder.reminder_id}`
                changeData(text)
                console.log(`reminder at id ${reminder.reminder_id} is deleted`)
            }else {
                const d = new Date(reminder.reminder_date)
                const new_date = reminder.recurringtype === "weekly" ?  getFutureDate("weekly", d, parseInt(reminder.day_of_week)) 
                                        : reminder.recurringtype === "monthly" ?  getFutureDate("monthly", d, parseInt(reminder.day_of_month))
                                        :  getFutureDate("daily", d) 
                
                
                console.log("new date: ",new_date)
                const text = `update reminder set reminder_date = $1 where reminder_id = $2;`
                const values = [new_date, reminder.reminder_id]
                await changeData(text, values)
                console.log("value updated!")
            }
        })
    })
});

// Log in to Discord with your client's token
client.login(process.env.DISCORD_TOKEN);

export {client}
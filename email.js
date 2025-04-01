import 'dotenv/config'
import { client as db} from './db.js'
import sgMail from  '@sendgrid/mail'
import schedule from "node-schedule";

sgMail.setApiKey(process.env.SENDGRID_API_KEY)

function getMonday(d) {
    d = new Date(d);
    let day = d.getDay(),
      diff = d.getDate() - day + (day == 0 ? -6 : 1); // adjust when day is sunday
    return new Date(d.setDate(diff));
}

function getThisWeek() {
    const monday = getMonday(new Date())
    const sunday = new Date(monday)
    sunday.setDate(sunday.getDate() + 6)
    return { monday, sunday }
}

const res = getThisWeek()
let monday_full = res["monday"]
let sunday_full = res["sunday"]
let monday = `${monday_full.getFullYear()}-${monday_full.getMonth()+1}-${monday_full.getDate()}`
let sunday = `${sunday_full.getFullYear()}-${sunday_full.getMonth()+1}-${sunday_full.getDate()}`



async function getRemindersThisWeek(monday, sunday) {
    try {
        const query = {
            text: `select * from reminder where reminder_date between '${monday}' and '${sunday}'`,    
        }
        const data = await db.query(query)
        return data.rows

    }catch (error){
        console.log("error",error)
        return {"msg":"something is wrong"}
    }
    
}

async function weeklyEmailReminder() {
    const reminders = await getRemindersThisWeek(monday, sunday)
    
    let htmlMsg = ``
    reminders.forEach((reminder) => {
        htmlMsg += `
        <h2>${reminder.event_name} </h2>
        <p> <strong>From </strong> <mark style="background-color: powderblue;"> ${reminder.event_from === "" ? "???" : reminder.event_from }</mark> <strong>To</strong> <mark style="background-color: powderblue;"> ${reminder.event_to === "" ? "???" : reminder.event_to } </mark> </p>
        <p> <strong>date:</strong> <mark style="background-color: powderblue;">${reminder.reminder_date}</mark> </p>
        <br/>
        `
    })

    const msg = {
        to: process.env.EMAIL_ADDRESS, // Change to your recipient
        from: process.env.EMAIL_ADDRESS, // Change to your verified sender
        subject: `Reminders This Week ${monday} to ${sunday} `,
        html: htmlMsg,
    }

    const rule = new schedule.RecurrenceRule();
    rule.hour = 14;
    rule.minute = 59;
    rule.dayOfWeek = 2
    rule.tz = 'America/New_York';

    schedule.scheduleJob(rule, async()=>{
        sgMail
        .send(msg)
        .then(() => {
            console.log('Email sent')
        })
        .catch((error) => {
            console.error(error)
        })
    })

}

export { weeklyEmailReminder }


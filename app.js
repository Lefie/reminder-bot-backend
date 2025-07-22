import express from 'express'
import bodyParser from 'body-parser'
import cors from 'cors'
import { changeData, queryDataGivenText } from './utils.js'
import { client as db} from './db.js'
import { client as discord_bot } from './bot.js'
import { weeklyEmailReminder } from './email.js'
import 'dotenv/config'

const app = express()


weeklyEmailReminder()

const allowedOrigins = ["http://localhost:5500","http://127.0.0.1:5500","http://localhost:5173","https://reminder-bot-frontend.vercel.app"]

// cors enabled
app.use(cors({
    origin: function(origin, cb){
        if(allowedOrigins.includes(origin) || !origin){
            cb(null, true)
        }else{
            cb(new Error("not allowed by CORS"))
        }
    },
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    credentials:true,
    allowedHeaders: ["Content-Type", "Authorization"],
    }
))


app.use(bodyParser.json())
const port = 3000
//app.options('*', cors());  // ?

app.post("/create_reminder", async(req, res) => {
    let {event_name, event_from, event_to, 
        reminder_date, recurring_type,
        day_of_week, day_of_month} = req.body


    console.log(event_name, event_from, event_to, 
        reminder_date, recurring_type,day_of_week, day_of_month)
    
    const insertionText = `INSERT INTO reminder (event_name, event_from, event_to, 
        reminder_date, isrecurring, recurringtype,day_of_week, day_of_month) VALUES($1, $2, $3, $4, $5, $6, $7, $8 ) `
    
    const isrecurring = recurring_type === "none" ? false : true
    const values = [event_name, event_from, event_to, reminder_date,isrecurring,recurring_type,day_of_week,day_of_month]
    try {
        const response = await changeData(insertionText, values)
        if(response === true) {
            return res.status(200).json({"msg":"insertion success"})
        }else{
            return res.status(500).json({"msg":"insertion not successful"})
        }
        
    }catch(error){
        console.log("an error occurred")
        res.status(500).json({"error":error})
    }
})

app.get("/get_all_reminders", async(req, res) => {
    
    try {
        const text = `select * from reminder order by reminder_date asc, event_from asc;`
        const all_reminders = await queryDataGivenText(text)
        if ( all_reminders.rows ) {
            //console.log(all_reminders)
            return res.status(200).json(all_reminders.rows)
        }else{
            return res.status(500).json({"msg": 'something is wrong'})
        }
        
    }catch(error){
        return res.status(500).json({"error": error})
    }
})

app.get("/get_reminder/:id", async(req, res) => {
    const reminder_item_id = req.params.id
    try {
        const text = `select * from reminder where reminder_id = ${reminder_item_id}`
        const reminder = await queryDataGivenText(text)
        if(reminder.rows) {
            return res.status(200).json(reminder.rows)
        }else {
            return res.status(500).json({'msg':'something went wrong'})
        }

    }catch(error) {
        return res.status(500).json({"error": error})
    }
})

app.get("/get_reminder/:date", async(req, res) => {
    const date = req.params.date
    try{
        const text = `select * from reminder where reminder_date='${date}'`
        const reminder = await queryDataGivenText(text)
        console.log(reminder.rows)
        if(reminder){
            return res.status(200).json(reminder.rows)
        }else{
            return res.status(500).json({"msg":"no such reminder"})
        }

    }catch(err){
        return res.status(500).json({"error": err})
    }
})


// get upcomingn reminders by a certain month // we can have user select a month ?
app.get("/get_reminders/:month", async(req,res)=>{
    const month = req.params.month
    console.log(typeof month)
    try {
        const text = `select * from reminder
        where extract(month from reminder_date) = ${month}
        ;`
        const all_reminders_by_month = await queryDataGivenText(text)
        if(all_reminders_by_month) {
            return res.status(200).json(all_reminders_by_month.rows)
        }

    }catch(error){
        return res.status(500).json({"error": error})
    }
})

// upcoming reminders - order by time, top {num} reminders etc. 
app.get("/get_reminders/top/:num", async(req, res) => {
    const num = req.params.num
    try {
        const text = `select * from reminder order by reminder_date asc limit ${num};`
        const top_reminders = await queryDataGivenText(text)
        if(top_reminders){
            return res.status(200).json(top_reminders.rows)
        }
    }catch(error){
        return res.status(500).json({"error": error})
    }
})

app.put("/update_reminder/:id", async(req, res) => {
    const payload = req.body
    const id = req.params.id
    let text = `UPDATE reminder SET `
    for (let key in payload) {
        if(key === "recurring_type"){
            text += `recurringtype='${payload["recurring_type"]}',`
        }else if(payload.hasOwnProperty(key)) {
            //console.log(key,payload[key])
            text+= `${key}='${payload[key]}', `
        }
    }
    text = text.slice(0, text.length - 2)
    text+=` where reminder_id=${id};`
    console.log(text)
    const result = await queryDataGivenText(text)
    console.log("Result", result)
    if(result){
        return res.status(200).json({"msg":"values updated"})
    }else{
        return res.status(500).json({"msg":"update unsuccesful"})
    }
})


app.delete("/delete/:reminder_id", async(req, res) => {
    const reminder_id = req.params.reminder_id
    try {
        const text = `delete from reminder where reminder_id = $1 `
        const values = [reminder_id]
        const query = {
            text: text,
            values: values
        }

        const response = await db.query(query)
        console.log(response)
        console.log(response.rows)
        return res.status(200).json({'msg':'deleted'})
    } catch(error) {
        return res.status(500).json({'error':error})
    }

})

app.listen(port, () => {
    console.log(`example app listening at port ${port}`)
})
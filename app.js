import express from 'express'
import bodyParser from 'body-parser'
import cors from 'cors'
import { changeData, queryDataGivenText, secureQuery, validateDateString } from './utils.js'
import { client as db} from './db.js'
import { client as discord_bot } from './bot.js'
import { weeklyEmailReminder } from './email.js'
import 'dotenv/config'

const app = express()


weeklyEmailReminder()

const allowedOrigins = ["http://localhost:5500","http://127.0.0.1:5500","http://localhost:5173","https://reminder-bot-sigma.vercel.app"]

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



app.get("/reminders", async(req, res) => {
    try {
        const text = `select * from reminder order by reminder_date asc, event_from asc;`
        const all_reminders = await secureQuery(text)
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

app.post("/reminder", async(req, res) => {
    let {event_name, event_from, event_to, 
        reminder_date, recurring_type,
        day_of_week, day_of_month} = req.body


    console.log(event_name, event_from, event_to, 
        reminder_date, recurring_type,day_of_week, day_of_month)
    
    const insertionText = `INSERT INTO reminder (event_name, event_from, event_to, 
        reminder_date, isrecurring, recurringtype,day_of_week, day_of_month) VALUES($1, $2, $3, $4, $5, $6, $7, $8 ) `
    
    const isrecurring = recurring_type === "none" ? false : true
    const values = [event_name, event_from, event_to, reminder_date,isrecurring,recurring_type,day_of_week,day_of_month]
    console.log("values",values)
    try {
        const response = await secureQuery(insertionText, values)
        console.log("response reminder", response)

        if(response.rowCount === 1) {
            return res.status(200).json(
                {"msg":"insertion success",
                  "reminder":response.rows[0]
                })
        }else{
            return res.status(500).json({"msg":"insertion not successful"})
        }
        
    }catch(error){
        console.log("an error occurred")
        res.status(500).json({"error":error})
    }

})

app.get("/reminder/:id", async(req,res) => {
    const reminder_item_id = req.params.id
    
    try {
        const text = `select * from reminder where reminder_id = $1`
        const values = [reminder_item_id]
        const result = await secureQuery(text, values)

        if (result.rows.length === 0) {
            return res.status(404).json({"msg":"reminders not found"})
        }
        return res.status(200).json(result.rows)

    }catch(err) {
        return res.status(500).json({"error": err})
    }
})

app.put("/reminder/:id", async(req, res) => {
  
    const id = req.params.id
    const payload = req.body  
    
    try {
       
        if (Object.keys(payload).length === 0) {
            return res.status(400).json({
                "error": "No fields to update",
                "msg": "Request body is empty"
            })
        }
        
        
        const allowedFields = [
            'event_name',
            'event_from',
            'event_to',
            'reminder_date',
            'isrecurring',
            'recurringtype', 
            'day_of_week',
            'day_of_month'
        ]
        
        
        const setClauses = []  // ["event_name = $1", "status = $2"]
        const values = []      // ["Meeting", "done"]
        let paramIndex = 1     // Counter for $1, $2, $3...
        
        /**
         * LOOP THROUGH EACH FIELD IN THE PAYLOAD
         * 
         * Object.entries(payload) converts:
         * {event_name: "Meeting", day_of_week: "Monday"}
         * 
         * Into:
         * [["event_name", "Meeting"], ["day_of_week", "Monday"]]
         */
        for (const [key, value] of Object.entries(payload)) {
            
            const dbColumnName = key === 'recurring_type' ? 'recurringtype' : key
            
            if (allowedFields.includes(dbColumnName)) {
                
                
                setClauses.push(`${dbColumnName} = $${paramIndex}`)
                
                values.push(value)
                
                paramIndex++
            } else {
                console.warn(`Attempted to update invalid field: ${key}`)
            }
        }
        
       
        if (setClauses.length === 0) {
            return res.status(400).json({
                "error": "No valid fields to update",
                "allowed_fields": allowedFields
            })
        }
        

        const text = `
            UPDATE reminder 
            SET ${setClauses.join(', ')}
            WHERE reminder_id = $${paramIndex}
            RETURNING *
        `
        
        values.push(id)
        
        const result = await secureQuery(text, values)

        console.log("updated result:", result)
        
      
        if (result.rowCount === 0) {
            return res.status(404).json({
                "error": "Reminder not found",
                "reminder_id": id
            })
        }
        
        
        return res.status(200).json({
            "msg": "Reminder updated successfully",
            "reminder": result.rows[0]  // The updated reminder
        })
        
    } catch(error) {
        console.error('Error updating reminder:', error)
        return res.status(500).json({
            "error": "Failed to update reminder",
            "details": error.message
        })
    }
})

app.delete("/reminder/:id", async(req, res) => {
    const reminder_id = req.params.id
    try {
        const text = `delete from reminder where reminder_id = $1`
        const values = [reminder_id]
      
        const response = await secureQuery(text, values)
        
        if (response.rowCount === 0) {
            return res.status(404).json(
                {"msg":"reminder not found",
                "delete_status":"false"
                })
        }
        return res.status(200).json({'msg':'deleted!',
            "delete_status":"true"})
    } catch(error) {
        return res.status(500).json({'error':error})
    }

})

// get reminders by filter - by date, by month, by top number
app.get("/reminder", async(req, res) => {
   
    const date = req.query.date
    const month = req.query.month
    const top = req.query.top

    if(date) {
        const dateValid = validateDateString(date)
        if (dateValid === false) {
            return res.status(400).json({"error":"date input is not valid"})
        }
        try {
            const text =  `select * from reminder where reminder_date=$1` 
            const values = [date]
            const result = await secureQuery(text, values)
            return res.status(200).json(result.rows)
        
        }catch(err){
            return res.status(500).json({"error": err})
        }
    }

    if(month) {
        try {
            const monthNumber = parseInt(month)

            if (isNaN(monthNumber) || monthNumber < 1 || monthNumber > 12) {
                return res.status(400).json({
                    "error":"Invalid month",
                    "msg": "month must be a numebr between 1 and 12"
                })
            }

            const text = `select * from reminder
            where extract(month from reminder_date) = $1`

            const values = [monthNumber]
            const results = await secureQuery(text, values)

            if (results ) {
                return res.status(200).json(results.rows)
            }

        }catch(error) {
            console.log(error)
            res.status(500).json({error})
        }

    }

    if (top) {
        const topNumber = parseInt(top)
        console.log("top number is", topNumber)
        try {
            if (isNaN(topNumber) || topNumber < 1 ) {
                return res.status(400).json({
                    "error":"Invalid number",
                    "msg": "top number must be at least 1"
                })
            } 

            const text = `select * from reminder order by reminder_date asc limit $1;`
            const values = [topNumber]

            const result = await secureQuery(text, values)
            console.log(result)

            if (result) {
                console.log("top queries",result)
                return res.status(200).json(result.rows)
            }
            
        }catch(error) {
           
            res.status(500).json({error})
        }
    }

    return res.status(400).json({
        "error": "No filter provided",
        "msg": "Provide one of the following query parameters:",
        
    })
    
})


app.listen(port, () => {
    console.log(`example app listening at port ${port}`)
})
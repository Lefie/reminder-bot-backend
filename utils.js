import { client as db} from './db.js'


export async function createTable() {
    // create the reminder table 
    try {
        const create_table_query = `
        CREATE TABLE IF NOT EXISTS reminder (
            reminder_id SERIAL PRIMARY KEY,
            event_name VARCHAR(255) NOT NULL,
            event_from TIME,
            event_to TIME,
            reminder_date DATE NOT NULL,
            isrecurring BOOLEAN NOT NULL,
            recurringtype VARCHAR(10) NOT NULL,
            day_of_week VARCHAR(10),
            day_of_month VARCHAR(10) 
        );
        `
        const table = await db.query(create_table_query)
        if(table){
            console.log("table inserted into database!")
        }
    }catch(err){
        console.log("error connecting the database or creating table")
        console.log(err)
    }
}


export async function getRemindersTodayArray() {
    try {
        const date = new Date()
        const year = date.getFullYear()
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const day = (date.getDate()).toString().padStart(2, '0');
        const date_str = `${year}-${month}-${day}`
        console.log(date_str)
        const statement = `select * from reminder where reminder_date = '${date_str}'`
        
    
        console.log(date_str)
        if(db){
            console.log("Database connected. Executing query...");
            const res = await db.query(statement);
            //console.log("Query result:", res.rows); // Print only the rows
            return res.rows;
        }  else{
            console.log("database is not connected")
        }
    }catch(err){
        console.log("error", err)
    }
}

export async function changeData(text, values=[]) {
    const query = {
        text: text,
        values: values
    }
    console.log("debugging log",query)

    try {
        const res = await db.query(query)
        console.log("res", res)
        console.log("data changed")
        return true
    }catch(err) {
        if(err){
            console.log("there is an error changing data")
            console.log(err)
        }
    }
}

export async function queryDataGivenText(text) {
    try {
        const data = await db.query({text:text})
        return data 
    } catch(error){
        console.log("error: ",error)
    }
}



// given the current date, get a future date
// frequency is either a week from date or a month from date : "weekly", "monthly"
// current_date is the date from which we start counting 

export function getFutureDate(frequency, current_date, day) {
    console.log(current_date)
    let res_str = ""

    if(frequency === "weekly"){
        const current_day = current_date.getDay()
        console.log(day, typeof day,  current_day, typeof current_day)
        let diff = day - (current_day + 1 )

 
        if(diff <= 0) {
            diff += 7
        }
        const new_date = new Date(current_date)
        new_date.setDate(current_date.getDate() + diff)

        // console.log(current_day, day, diff)
        console.log(new_date)
       
        const date = new_date.getDate()
        const month = new_date.getMonth() + 1
        const year = new_date.getFullYear()
        console.log(new_date.getDay(),date,month, year)
        res_str = `${year}-${month}-${date + 1}`

    }else if(frequency === "monthly"){
        //update
        const cur_month = current_date.getMonth() + 1
        const cur_yr = current_date.getFullYear()
        let new_date = `${cur_yr}-${cur_month + 1}-${day}`
        new_date = new Date(new_date)
        res_str = `${new_date.getFullYear()}-${new_date.getMonth() + 1}-${new_date.getDate()}`
    
    }else if(frequency === "daily"){
        console.log("current date",current_date.getDate())
        const cur_month = current_date.getMonth() + 1;
        const cur_yr = current_date.getFullYear()
        const cur_date = current_date.getDate()
        let new_date = `${cur_yr}-${cur_month}-${cur_date + 1}`
        console.log(new_date)
        new_date = new Date(new_date)
        console.log(new_date)
        res_str = `${new_date.getFullYear()}-${new_date.getMonth() + 1}-${new_date.getDate()}`
    } 
    console.log("final result",res_str)
    return res_str
}


// test 
/*
async function testGetReminders() {
    try {
        await db.connect(); // Ensure connection
        console.log("Database connected.");

        const reminders = await getRemindersTodayArray();
        console.log("Reminders:", reminders);

       // await db.end(); // Properly close connection after test
    } catch (err) {
        console.log("Error:", err);
    }
}

await testGetReminders()
*/

/*
async function insertData(text, values) {
    try {
    
        await changeData(text, values);
        console.log("data inserted")

    } catch (err) {
        console.log("Error:", err);
    }
}

const text = `INSERT INTO reminder(event_name, event_from, event_to, reminder_date, isRecurring, isReminded, recurringType) 
VALUES($1, $2, $3, $4, $5, $6, $7 )`

const values = ['br roland bd','1:00','23:30','2025-02-17',true,false,'none']

await insertData(text, values)
*/

//future date 

/*
const d = new Date("2025-03-02")
const freq = "weekly"
const day = 7
getFutureDate(freq, d,day)
*/
// 2025-02-25T05:00:00.000Z
/*
const d = new Date("2025-03-02T00:00:00.000Z")
const freq = "weekly"
const day = 7

const res = getFutureDate(freq, d,day)
console.log(res)
*/



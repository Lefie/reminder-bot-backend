import pg from 'pg'
const { Client } = pg
import dotenv from 'dotenv'
import { createTable } from './utils.js';
dotenv.config();

//dev

const client = new Client({
    user: "lemon",
    host: "localhost",
    database: "postgres",
    port:"5432"
})


// const client = new Client({
//     connectionString: process.env.DATABASE_URL,
//     ssl: { rejectUnauthorized: false }
// })


async function connectDB() {
    try {   
        await client.connect()
        console.log("connected !")
        await createTable();
    } catch(error) {
        if(error){
            console.log("error connecting to db")
            console.log(error)
        }
    }
}

connectDB();
export { client }


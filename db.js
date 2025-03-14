import pg from 'pg'
const { Client } = pg

//dev
/*
const client = new Client({
    user: "lemon",
    host: "localhost",
    database: "postgres",
    port:"5432"
})
*/

const client = new Client({
    user: process.env.PGUSER,
    password: process.env.PGPASSWORD,
    host: process.env.PGHOST,
    port: process.env.PGPORT,
    database:process.env.PGDATABASE
})

try {   
    await client.connect()
    console.log("connected !")
} catch(error) {
    if(error){
        console.log("error connecting to db")
        console.log(error)
    }
}

export { client }


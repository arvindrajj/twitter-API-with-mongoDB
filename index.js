const express = require('express');
const {MongoClient} = require('mongodb')
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')

const url = 'mongodb://localhost:27017'

const client = new MongoClient(url)
const app = express()
app.use(express.json())


let userCollection;
const startDbAndServer = async () => {
    try {
        await client.connect()
        db = client.db('twitterDb')
        userCollection = db.collection('user')
        app.listen(8016, () => {
            console.log("Server is Running at http://localhost:8016");
          });
    } catch (e){
        console.log(`DB Error: ${e.message}`)
    }   
}

startDbAndServer()

app.post("/register/", async (req, res) => {
    const {username, password, name, gender} = req.body;
    console.log(req.body)
    const userDb = await userCollection.find({ username: username });
      if (userDb.username === undefined) {
        const isPasswordValid = password.length > 6;
        if (isPasswordValid) {
          const hashedPassword = await bcrypt.hash(password, 10);
          await userCollection.insert(body);
          res.send("User created successfully");
        } else {
          res.status(400);
          res.send("Password is too short");
        }
      } else {
        res.status(400);
        res.send("User already exists");
      }
  });
  
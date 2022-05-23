const express = require('express');
const {MongoClient} = require('mongodb')
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken');
const { hash } = require('bcrypt');

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

const authenticateJwtToken = async (req, res, next) => {
  const authorHeader = req.headers["authorization"];
  if (authorHeader !== undefined) {
    const jwtToken = authorHeader.split(" ")[1];
    jwt.verify(jwtToken, "MY_SECRET_KEY", async (error, payload) => {
      if (error) {
        res.status(401);
        res.send("Invalid JWT Token");
      } else {
        req.username = payload.username;
        req.user_id = payload.user_id;
        next();
      }
    });
  } else {
    res.status(401);
    res.send("Invalid JWT Token");
  }
};

app.post("/register/", async (req, res) => {
    const {username, password} = req.body;
    let user = await userCollection.find({users : {$elemMatch: {username: username}}}).toArray()
    if (user[0] === undefined) {
      const isPasswordValid = password.length > 6;
      if (isPasswordValid) {
        user = await userCollection.findOne()
        let {user_id} = user.users[user.users.length - 1]
        user_id += 1
        const hashedPassword = await bcrypt.hash(password, 10);
        await userCollection.updateOne({_id: user._id},
          {
            $push: {
              users: {user_id, ...req.body, password: hashedPassword}
            }
          });
        res.send("User added successfully");
      } else {
        res.status(400);
        res.send("Password is too short");
      }
      } else {
        res.status(400);
        res.send("User already exists");
      }
  });
  
app.post("/login/", async (req, res) => {
  const { username, password } = req.body;
  let user = await userCollection.find({"users.username": username}).toArray();
  if (user[0] !== undefined) {
    user = user[0].users.filter(each => each.username === username)
  }
  if (user[0] != undefined) {
    const isValidPassword = await bcrypt.compare(password, user[0].password);
    if (isValidPassword) {
      const payload = { user_id: user[0].user_id, username: username };
      const jwtToken = jwt.sign(payload, "MY_SECRET_KEY");
      res.send(jwtToken);
    } else {
      res.status(400);
      res.send("Invalid password");
    }
  } else {
    res.status(400);
    res.send("Invalid user");
  }
});

app.get("/user/tweets/feed/", authenticateJwtToken, async (req, res) => {
  const {user_id} = req;
  let user = await userCollection.find({}).toArray()
  let userFollowingArray = user[0].follower.filter(each => each.follower_user_id === user_id)  
  userFollowingArray = userFollowingArray.map(each => each.following_user_id)
  let usernamesArray = user[0].users.filter(each => userFollowingArray.includes(each.user_id))
  let tweetsSArray = user[0].tweet.filter(each =>  userFollowingArray.includes(each.user_id))
  let result = []
  usernamesArray.map(eachUser => {
    tweetsSArray.map(eachTweet => {
      if ( eachUser.user_id === eachTweet.user_id) {
        result = [
          ...result,
          {
            username: eachUser.username,
            tweet: eachTweet.tweet,
            dateTime: eachTweet.date_time
          }
        ]
      }
    })
  })
  res.send(result)
});

app.get("/tweets/:tweetId/", authenticateJwtToken, async (req,res) => {
  let {tweetId} = req.params
  tweetId = parseInt(tweetId)
  const user = await userCollection.findOne()
  const tweet = user.tweet.filter(eachTweet => eachTweet.tweet_id === tweetId)
  res.send(tweet)
})

app.post("/user/tweets/", authenticateJwtToken, async (req, res) => {
    const {user_id} = req
    const {tweet} = req.body
    const user = await userCollection.findOne()
    let {tweet_id} = user.tweet[user.tweet.length - 1] 
    tweet_id += 1
    await userCollection.updateOne({}, 
      { $push : {
        tweet: { tweet_id, tweet, user_id, date_time: new Date()}
      }})
    res.send('Created a Tweet')
})

app.put("/user/password_reset/", authenticateJwtToken, async (req, res) => {
    const {user_id} = req
    const {newPassword, oldPassword} = req.body
    const userDb = await userCollection.findOne()
    const [user] = userDb.users.filter(each => each.user_id === user_id) 
    const isValidPassword = await bcrypt.compare(oldPassword, user.password)
    if (isValidPassword) {
      const hashedPassword = await bcrypt.hash(newPassword, 10)
      await userCollection.updateOne({"users.user_id" : user_id}, 
        { $set: {
          "users.$.password": hashedPassword 
        }}
        )
      res.send('Password updated successfully')
    } else {
      res.status(400)
      res.send("Invalid oldPassword");
    }
  })

app.delete("/tweets/:tweetId/", authenticateJwtToken, async (req, res) => {
  let {tweetId} = req.params
  tweetId = parseInt(tweetId)
  await userCollection.updateOne({"tweet.tweet_id": tweetId},
  {$pull: {
    tweet: {tweet_id: tweetId}
  }})
  res.send("Tweet Removed")
})


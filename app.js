const express = require("express");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");

const path = require("path");
const dbPath = path.join(__dirname, "twitterClone.db");

const app = express();
app.use(express.json());

let database = null;

const intializeDbServer = async () => {
  try {
    database = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("server start at http://localhost:3000/");
    });
  } catch (e) {
    console.log(`error at ${e.message}`);
    process.exit(1);
  }
};
intializeDbServer();

////////////////////////midleware////////////////////
const Authentication = (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];

  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }

  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "ajay", async (error, payload) => {
      if (error) {
        response.send("Invalid JWT Token");
      } else {
        request.username = payload.username;
        next();
      }
    });
  }
};

//////////////// API-1///////
app.post("/register/", async (request, response) => {
  const { username, password, name, gender } = request.body;
  const hashedPassword = await bcrypt.hash(request.body.password, 10);

  const userfoundQuery = `
  select * from user
  where
  username='${username}';`;
  const userIn = await database.get(userfoundQuery);
  //console.log(userIn);

  if (userIn === undefined) {
    const lengthPassword = password.length;
    //console.log(lengthPassword);
    if (lengthPassword < 6) {
      response.status(400);
      response.send("Password is too short");
    } else {
      const insertQuery = `
        insert into user(name,username,password,gender)
        values(
            '${name}',
            '${username}',
            '${hashedPassword}',
            '${gender}'
        );`;
      await database.run(insertQuery);
      response.status(200);
      response.send("User created successfully");
    }
  } else {
    response.status(400);
    response.send("User already exists");
  }
});

//////////////////////// API-2 /////////////
app.post("/login/", async (request, response) => {
  const { username, password } = request.body;

  const userCheckQuery = `
  select * from user
  where
  username='${username}';`;
  const userCheck = await database.get(userCheckQuery);
  //console.log(userCheck);

  if (userCheck === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const matchPassword = await bcrypt.compare(password, userCheck.password);
    //console.log(matchPassword);
    if (matchPassword === true) {
      const payload = {
        username: username,
      };
      const jwtToken = jwt.sign(payload, "ajay");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

////////////API-3////////
app.get("/user/tweets/feed/", Authentication, async (request, response) => {
  const getTweetQuery = `
    select 
    user.username,
    tweet.tweet,
    tweet.date_time
    from 
     (user
    inner join 
     tweet
    on user.user_id=tweet.user_id) as t
    inner join follower
    on user.user_id=follower.follower_user_id
    group by user.user_id
    order by tweet_id desc
    limit 4
    ;`;
  const data = await database.all(getTweetQuery);
  response.send(data);
});

///////////API-4/////////////////
app.get("/user/following/", Authentication, async (request, response) => {
  const getNamesQuery = `
    select 
    user.name 
    from 
    user 
    inner join 
    follower
    on user.user_id=follower.following_user_id
    group by user.user_id
    ;`;
  const data = await database.all(getNamesQuery);
  response.send(data);
});

///////////API-5///////////////////////////
app.get("/user/followers/", Authentication, async (request, response) => {
  const getNamesQuery = `
    select 
    user.name 
    from 
    user 
    inner join 
    follower
    on user.user_id=follower.follower_user_id
    group by user.user_id
    ;`;
  const data = await database.all(getNamesQuery);
  response.send(data);
});

////////////////////API-6/////////////////////////////////
app.get("/tweets/:tweetId/", Authentication, async (request, response) => {
  const { tweetId } = request.params;

  const userExitQuery = `
    select
    *
    from 
    tweet
    where
    tweet.tweet_id=${tweetId};`;
  const tweetExists = await database.all(userExitQuery);

  if (tweetExists !== undefined) {
    const dataQuery = `
      select
      tweet.tweet,
      count(like_id) as likes,
      count(reply_id) as replies,
      tweet.date_time as dateTime
      from 
      (tweet
        inner join
        reply
        on tweet.tweet_id=reply.tweet_id) as t
        inner join 
        like
        on reply.tweet_id=like.tweet_id
        where tweet.tweet_id=${tweetId};`;
    const data = await database.get(dataQuery);
    response.send(data);
  } else {
    response.status(401);
    response.send("Invalid Request");
  }
});

///////////API-7////////////////////////////
app.get(
  "/tweets/:tweetId/likes/",
  Authentication,
  async (request, response) => {
    const { tweetId } = request.params;

    const userTweetExit = `
    select
    * from 
    tweet
    where
    tweet_id=${tweetId};`;
    const data = await database.get(userTweetExit);
    //response.send(data);

    if (data !== undefined) {
      const likeUserQuery = `
        select
        name 
        from 
        (tweet
        inner join
        user
        on tweet.user_id=user.user_id) as t
        inner join 
        like 
        on user.user_id=like.user_id
        where tweet.tweet_id=${tweetId};`;
      const likes = await database.get(likeUserQuery);
      response.send(likes);
    } else {
      response.status(401);
      response.send("Invalid Request");
    }
  }
);
////////api-8///////
app.get(
  "/tweets/:tweetId/replies/",
  Authentication,
  async (request, response) => {
    const { tweetId } = request.params;

    const gettweetQuery = `
    select 
    name,
    reply 
    from
    (user 
    inner join 
    reply
    on user.user_id=reply.user_id) as t
    inner join 
    tweet
    on tweet.user_id=user.user_id
    where
    tweet.tweet_id=${tweetId};`;
    const replies = await database.all(gettweetQuery);
    response.send({ replies });
  }
);

/////api9/////
app.get("/user/tweets/", Authentication, async (request, response) => {
  const getTweetsQuery = `
  select
  tweet,
  count(reply_id) as replies,
  count(like_id) as likes,
  date_time as dateTime

  from 
  (tweet 
    inner join 
   reply
   on tweet.user_id=reply.user_id) as t
   inner join 
   like
   on reply.user_id=like.user_id
   group by tweet.user_id;

    
    `;
  const getTweets = await database.all(getTweetsQuery);
  response.send(getTweets);
});

/////////api10/////////
app.post("/user/tweets/", Authentication, async (request, response) => {
  const { tweetCreate } = request.body;
  const postTweetQuery = `
  insert into tweet(tweet)
  values(
      '${tweetCreate}'
  );`;
  const newTweet = await database.run(postTweetQuery);
  response.send("Created a Tweet");
});

///////api11////////
app.delete("/tweets/:tweetId/", Authentication, async (request, response) => {
  const { tweetId } = request.params;

  const tweetExitQuery = `
  select
  *
  from 
  tweet
  where tweet_id=${tweetId};`;
  const tweetExit = await database.get(tweetExitQuery);

  if (tweetExit.tweet_id !== undefined) {
    const deleteQuery = `
    delete
    from 
    tweet
    where tweet.tweet_id=${tweetId};`;
    await database.run(deleteQuery);
    response.send("Tweet Removed");
  } else {
    response.status(401);
    response.send("Invalid Request");
  }
});

module.exports = app;

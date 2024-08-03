const express = require("express");
const path = require("path");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
var cors = require("cors");

const app = express();

app.use(express.json());
app.use(cors());

const dbPath = path.join(__dirname, "database.db");

let db = null;

const dbRunner = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });

    app.listen(3000, () => {
      console.log("Database has been connected and running at 3000");
    });
  } catch (error) {
    console.log(error);
    process.exit(1);
  }
};

dbRunner();

//Authentication of jwt token
const authenticateToken = (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "token", async (error, payLoad) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        request.headers.username = payLoad.username;
        next();
      }
    });
  }
};

// register a user api
app.post("/register/", async (request, response) => {
  const { username, password, name, gender } = request.body;
  const hashPassword = await bcrypt.hash(password, 10);
  const usernameQuery = `SELECT * FROM user WHERE username = '${username}';`;

  const userExist = await db.get(usernameQuery);

  if (userExist === undefined) {
    if (password.length < 6) {
      response.status(400);
      response.send("Password is too short");
    } else {
      addUserQuery = `INSERT INTO user (username,password,name,gender)
        VALUES ('${username}','${hashPassword}','${name}','${gender}');`;
      const addUser = await db.run(addUserQuery);
      response.status(200);
      response.send("User created successfully");
    }
  } else {
    response.status(400);
    response.send("User already exists");
  }
});

//login api
app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const checkUserQuery = `SELECT * FROM user WHERE username = '${username}';`;
  const checkUser = await db.get(checkUserQuery);

  if (checkUser === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const isCorrectPassword = await bcrypt.compare(
      password,
      checkUser.password
    );
    if (isCorrectPassword) {
      response.status(200);
      const payload = {
        username: username,
      };
      const jwtToken = jwt.sign(payload, "MY_SECRET_TOKEN");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

//Creating event..
app.post("/event/", async (request, response) => {
  //   const { username } = request.headers;
  const { event_name, event_id, location } = request.body;
  const checkId = `SELECT * FROM event WHERE event_id = ${event_id};`;
  const idExist = await db.get(checkId);
  if (idExist !== undefined) {
    response.status(400);
    response.send("Id already exist");
  } else {
    const eventQuery = `INSERT INTO event(event_name,event_id,username,location) VALUES ('${event_name}',${event_id},'username','${location}');`;
    const addEvent = await db.run(eventQuery);
    response.send("Created a Event");
  }
});

//get all events for user
app.get("/event/", async (request, response) => {
  const { username } = request.headers;
  const eventQuery = `SELECT * FROM event /* WHERE username = '${username}'*/;`;
  const events = await db.all(eventQuery);
  response.send(events);
});

//update an event
app.put("/events/:id", authenticateToken, async (request, response) => {
  const { id } = request.params;
  const { event_name, location } = request.body;
  const checkId = `SELECT * FROM event WHERE event_id = ${id};`;
  const idExist = await db.get(checkId);
  if (idExist === undefined) {
    response.status(400);
    response.send("Id not found");
  } else {
    const updateQuery = `UPDATE event SET event_name = '${event_name}', location = '${location}' WHERE event_id = ${id};`;
    await db.run(updateQuery);
    response.send("column updated");
  }
});

//delete an event
app.delete("/events/:id", async (request, response) => {
  const { id } = request.params;
  const checkId = `SELECT * FROM event WHERE event_id = ${id};`;
  const idExist = await db.get(checkId);
  if (idExist === undefined) {
    response.status(400);
    response.send("Id not found");
  } else {
    deleteQuery = `DELETE from event WHERE event_id = ${id};`;
    await db.run(deleteQuery);
    response.send("Event Removed");
  }
});

//Get weather details
// Function to fetch weather data
async function getWeatherData(city) {
  const apiKey = "0780c1db55b38a62808b8dbb70ef7c96";
  const weatherURL = `http://api.openweathermap.org/data/2.5/weather?q=${city}&appid=${apiKey}`;
  try {
    const fetch = require("node-fetch");
    const response = await fetch(weatherURL);
    const weatherData = await response.json();
    return weatherData;
  } catch (error) {
    console.log("Error fetching weather data:", error);
    throw error;
  }
}

app.get("/weather/:location", async (request, response) => {
  const { location } = request.params;
  getWeatherData(location)
    .then((data) => {
      console.log(data);
      response.send(data);
    })
    .catch((error) => {
      console.error(error);
    });
});

// Session management
const session = require("express-session");
const cookieParser = require("cookie-parser");

app.use(cookieParser());

app.use(
  session({
    secret: "user",
    saveUninitialized: true,
    resave: true,
  })
);

app.get("/session", (request, response) => {
  if (request.session.view) {
    request.session.view++;
    response.send(
      "You visited this page for " + request.session.view + " times"
    );
  } else {
    request.session.view = 1;
    response.send(
      "You have visited this page" + " for first time ! Welcome...."
    );
  }
});

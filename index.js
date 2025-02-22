require("dotenv").config();
const express = require("express");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const http = require("http");
const cors = require("cors");
const socketIo = require("socket.io");
const port = process.env.PORT || 5000;
const jwt = require("jsonwebtoken");

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: ["https://getitdone-24.web.app", "http://localhost:5173"],
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true,
  },
});

// Middleware
app.use(
  cors({
    origin: ["https://getitdone-24.web.app", "http://localhost:5173"],
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true,
  })
);

app.use(express.json());

// MongoDB Connection
const uri = `mongodb+srv://${process.env.DB_USERNAME}:${process.env.DB_PASSWORD}@cluster0.ezm1s.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

let userCollection, tasksCollection;

async function run() {
  try {
    // await client.db("admin").command({ ping: 1 });

    userCollection = client.db("get-it-done").collection("users");
    tasksCollection = client.db("get-it-done").collection("tasks");

    // jwt api
    app.post("/jwt", async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "3h",
      });
      res.send({ token });
    });

    // verify token
    const verifyToken = (req, res, next) => {
      if (!req.headers.authorization) {
        return res.status(401).send({ message: "Forbidden Access" });
      }

      const token = req.headers.authorization.split(" ")[1];

      jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
          return res.status(401).send({ message: "Forbidden Access" });
        }
        req.decoded = decoded;
        next();
      });
    };

    console.log("Successfully connected to MongoDB!");

    // Socket.IO Connection
    io.on("connection", (socket) => {
      console.log("A user connected with ID:", socket.id);

      // Send a response to the frontend when the user connects
      socket.emit("connectionResponse", {
        message: "Connection successful",
        socketId: socket.id,
      });

      // Handle disconnect
      socket.on("disconnect", () => {
        console.log("A user disconnected with ID:", socket.id);
      });
    });

    // POST routes
    // post user while login/register
    app.post("/users", async (req, res) => {
      try {
        const user = req.body;
        const query = { email: user.email };
        const existingUser = await userCollection.findOne(query);

        if (existingUser) {
          return res
            .status(400)
            .send({ message: "USER ALREADY EXISTS", insertedId: null });
        }

        const userToBeAdded = {
          ...user,
          createdAt: new Date(),
        };
        const result = await userCollection.insertOne(userToBeAdded);
        res.status(201).send(result);
      } catch (error) {
        console.error("Error adding user:", error);
        res.status(500).send({ message: "Internal Server Error" });
      }
    });

    // add tasks
    app.post("/add-tasks", verifyToken, async (req, res) => {
      try {
        const taskData = req.body;
        const userMail = taskData.email;
        if (!taskData) {
          return res.send({ message: "resource not found" });
        }

        if (userMail !== req.decoded.email) {
          return res.status(403).send({ message: "Unauthorized access" });
        }

        const finalData = {
          ...taskData,
          createdAt: new Date(),
          order: parseInt(0),
        };
        const result = await tasksCollection.insertOne(finalData);
        io.emit("TaskAdded", finalData);
        res.send(result);
      } catch (error) {
        console.error("Error adding task:", error);
        res.status(500).send({ message: "Internal Server Error" });
      }
    });

    // GET OPERATIONS
    // get operation for todo route
    app.get("/todo-tasks", verifyToken, async (req, res) => {
      try {
        const userMail = req?.query.query;

        // Check if email exists in the query
        if (!userMail) {
          return res.status(400).send("Email query parameter is required.");
        }

        if (userMail !== req.decoded.email) {
          return res.status(403).send({ message: "Unauthorized access" });
        }

        const filter = { email: userMail, task_category: "not started" };

        const cursor = tasksCollection.find(filter).sort({ order: 1 });
        const result = await cursor.toArray();
        res.send(result);
      } catch (error) {
        console.error("Error fetching tasks:", error);
        res.status(500).send("Internal Server Error");
      }
    });

    // get operation for in progress route
    app.get("/in-progress-tasks", verifyToken, async (req, res) => {
      try {
        const userMail = req?.query.query;

        // Check if email exists in the query
        if (!userMail) {
          return res.status(400).send("Email query parameter is required.");
        }

        if (userMail !== req.decoded.email) {
          return res.status(403).send({ message: "Unauthorized access" });
        }

        const filter = { email: userMail, task_category: "in progress" };

        const cursor = tasksCollection.find(filter).sort({ createdAt: -1 });
        const result = await cursor.toArray();
        res.send(result);
      } catch (error) {
        console.error("Error fetching tasks:", error);
        res.status(500).send("Internal Server Error");
      }
    });

    // get operation for completed route
    app.get("/completed-tasks", verifyToken, async (req, res) => {
      try {
        const userMail = req?.query.query;
        // Check if email exists in the query
        if (!userMail) {
          return res.status(400).send("Email query parameter is required.");
        }

        if (userMail !== req.decoded.email) {
          return res.status(403).send({ message: "Unauthorized access" });
        }

        const filter = { email: userMail, task_category: "completed" };

        const cursor = tasksCollection.find(filter).sort({ createdAt: -1 });
        const result = await cursor.toArray();
        res.send(result);
      } catch (error) {
        console.error("Error fetching tasks:", error);
        res.status(500).send("Internal Server Error");
      }
    });

    // get operation for my tasks route
    app.get("/all-tasks", verifyToken, async (req, res) => {
      try {
        const userMail = req?.query.query;

        // Check if email exists in the query
        if (!userMail) {
          return res.status(400).send("Email query parameter is required.");
        }

        if (userMail !== req.decoded.email) {
          return res.status(403).send({ message: "Unauthorized access" });
        }

        const filter = { email: userMail, task_category: { $ne: "completed" } };

        const cursor = tasksCollection.find(filter).sort({ createdAt: -1 });
        const result = await cursor.toArray();
        res.send(result);
      } catch (error) {
        console.error("Error fetching tasks:", error);
        res.status(500).send("Internal Server Error");
      }
    });

    // get operation for completed route
    app.get("/vital-tasks", verifyToken, async (req, res) => {
      try {
        const userMail = req?.query.query;

        // Check if email exists in the query
        if (!userMail) {
          return res.status(400).send("Email query parameter is required.");
        }

        if (userMail !== req.decoded.email) {
          return res.status(403).send({ message: "Unauthorized access" });
        }

        const filter = { email: userMail, task_priority: "extreme" };

        const cursor = tasksCollection.find(filter).sort({ createdAt: -1 });
        const result = await cursor.toArray();
        res.send(result);
      } catch (error) {
        console.error("Error fetching tasks:", error);
        res.status(500).send("Internal Server Error");
      }
    });

    // DELETE OPERATIONS
    // delete tasks
    app.delete("/task/:id", verifyToken, async (req, res) => {
      const taskId = req.params.id;
      const filter = { _id: new ObjectId(taskId) };
      const result = await tasksCollection.deleteOne(filter);
      io.emit("TaskDeleted", taskId);
      res.send(result);
    });

    // PUT OPERATIONS
    // put operation for task update
    app.put("/task-update/:id", verifyToken, async (req, res) => {
      const taskId = req.params.id;
      const filter = { _id: new ObjectId(taskId) };

      // Data from client
      const updatedTask = req.body;

      if (!updatedTask) {
        return res.status(404).send({ message: "Resource Not Found" });
      }

      const task = await tasksCollection.findOne(filter);

      if (!task) {
        return res.status(404).send({ message: "Task not found" });
      }

      // Change detecting
      let matched = true;
      for (const key in updatedTask) {
        if (updatedTask[key] !== task[key]) {
          matched = false;
          break;
        }
      }

      if (matched) {
        return res.send({
          message: "Saved! Nothing changed.",
          modifiedCount: 0,
        });
      }

      const finalTask = {
        $set: updatedTask,
      };

      const result = await tasksCollection.updateOne(filter, finalTask);

      // Add _id, email, task_priority, and old_priority to the updatedTask before emitting
      const updatedTaskWithId = {
        ...updatedTask,
        _id: taskId,
        email: task.email,
        task_priority: updatedTask.task_priority,
        old_priority: task.task_priority,
        old_category: task.task_category,
        createdAt: task.createdAt,
      };
      io.emit("TaskUpdate", updatedTaskWithId);

      res.send(result);
    });

    // PATCH OPERATIONS
    // patch operation for task update
    app.patch("/update-task-order", verifyToken, async (req, res) => {
      const { tasks, email } = req.body;

      try {
        if (email !== req.decoded.email) {
          return res.status(403).send({ message: "Unauthorized access" });
        }

        const bulkOperations = tasks.map((task) => ({
          updateOne: {
            filter: { _id: new ObjectId(String(task._id)) },
            update: { $set: { order: task.order } },
          },
        }));

        const result = await tasksCollection.bulkWrite(bulkOperations);

        io.emit("TaskOrderUpdated", { email, tasks });

        res.send({ message: "Task order updated successfully", result });
      } catch (error) {
        console.error(error);
        res.status(500).send({ message: "Internal Server Error" });
      }
    });

    // patch for update completed
    app.patch("/task-completed/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const updatedCategory = req.body;

      const data = {
        ...updatedCategory,
        id,
      };

      if (!updatedCategory && id) {
        return res.status(404).json({ message: "Resource not found" });
      }

      const result = await tasksCollection.findOneAndUpdate(
        { _id: new ObjectId(id) },
        { $set: updatedCategory },
        { new: false, upsert: false }
      );

      io.emit("TaskCompleted", data);

      res.status(200).json({
        message: "User updated with role 'Admin'",
        updated: true,
      });
    });
  } catch (error) {
    console.error("Failed to connect to MongoDB:", error);
    process.exit(1); // Exit the process if MongoDB connection fails
  }
}

run().catch(console.dir);

// Graceful shutdown
process.on("SIGINT", async () => {
  try {
    // await client.close();
    process.exit(0);
  } catch (error) {
    console.error("Error closing MongoDB connection:", error);
    process.exit(1);
  }
});

app.get("/", (req, res) => {
  res.send("Get It Done is running");
});

server.listen(port, () => {
  console.log(`Get It Done is running on port ${port}`);
});

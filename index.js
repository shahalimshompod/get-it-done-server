require("dotenv").config();
const express = require("express");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const http = require("http");
const cors = require("cors");
const socketIo = require("socket.io");
const port = process.env.PORT || 5000;

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE"],
  },
});

// Middleware
app.use(cors());
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
    await client.connect();
    await client.db("admin").command({ ping: 1 });

    userCollection = client.db("get-it-done").collection("users");
    tasksCollection = client.db("get-it-done").collection("tasks");

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
    app.post("/add-tasks", async (req, res) => {
      try {
        const taskData = req.body;
        if (!taskData) {
          return res.send({ message: "resource not found" });
        }

        const finalData = {
          ...taskData,
          createdAt: new Date(),
        };
        const result = await tasksCollection.insertOne(finalData);
        io.emit("TaskAdded", finalData); // Emit task added event to all connected clients
        res.send(result);
      } catch (error) {
        console.error("Error adding task:", error);
        res.status(500).send({ message: "Internal Server Error" });
      }
    });

    // GET OPERATIONS
    // get operation for todo route
    app.get("/todo-tasks", async (req, res) => {
      try {
        const userMail = req?.query.query;

        console.log(userMail);

        // Check if email exists in the query
        if (!userMail) {
          return res.status(400).send("Email query parameter is required.");
        }

        const filter = { email: userMail, task_category: "not started" };

        const cursor = tasksCollection.find(filter).sort({ createdAt: -1 });
        const result = await cursor.toArray();
        res.send(result);
      } catch (error) {
        console.error("Error fetching tasks:", error);
        res.status(500).send("Internal Server Error");
      }
    });

    // get operation for in progress route
    app.get("/in-progress-tasks", async (req, res) => {
      try {
        const userMail = req?.query.query;

        console.log(userMail);

        // Check if email exists in the query
        if (!userMail) {
          return res.status(400).send("Email query parameter is required.");
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
    app.get("/completed-tasks", async (req, res) => {
      try {
        const userMail = req?.query.query;

        console.log(userMail);

        // Check if email exists in the query
        if (!userMail) {
          return res.status(400).send("Email query parameter is required.");
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
    app.get("/all-tasks", async (req, res) => {
      try {
        const userMail = req?.query.query;

        console.log(userMail);

        // Check if email exists in the query
        if (!userMail) {
          return res.status(400).send("Email query parameter is required.");
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
    app.get("/vital-tasks", async (req, res) => {
      try {
        const userMail = req?.query.query;

        console.log(userMail);

        // Check if email exists in the query
        if (!userMail) {
          return res.status(400).send("Email query parameter is required.");
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
    app.delete("/task/:id", async (req, res) => {
      const taskId = req.params.id;
      const filter = { _id: new ObjectId(taskId) };
      const result = await tasksCollection.deleteOne(filter);
      io.emit("TaskDeleted", taskId);
      res.send(result);
    });

    // PUT OPERATIONS
    // put operation for task update
    // app.put("/task-update/:id", async (req, res) => {
    //   const taskId = req.params.id;
    //   const filter = { _id: new ObjectId(taskId) };

    //   // Data from client
    //   const updatedTask = req.body;
    //   console.log("Updated Task from Client:", updatedTask);

    //   if (!updatedTask) {
    //     return res.status(404).send({ message: "Resource Not Found" });
    //   }

    //   const task = await tasksCollection.findOne(filter);

    //   if (!task) {
    //     return res.status(404).send({ message: "Task not found" });
    //   }

    //   // Change detecting
    //   let matched = true;
    //   for (const key in updatedTask) {
    //     if (updatedTask[key] !== task[key]) {
    //       matched = false;
    //       break;
    //     }
    //   }

    //   console.log("Is Data Matched?", matched);

    //   if (matched) {
    //     return res.send({
    //       message: "Saved! Nothing changed.",
    //       modifiedCount: 0,
    //     });
    //   }

    //   const finalTask = {
    //     $set: updatedTask,
    //   };

    //   const result = await tasksCollection.updateOne(filter, finalTask);

    //   // Add _id, email, and task_priority to the updatedTask before emitting
    //   const updatedTaskWithId = {
    //     ...updatedTask,
    //     _id: taskId,
    //     email: task.email,
    //     task_priority: task.task_priority,
    //   };
    //   console.log("Emitting TaskUpdate:", updatedTaskWithId); // Debugging
    //   io.emit("TaskUpdate", updatedTaskWithId);

    //   res.send(result);
    // });

    app.put("/task-update/:id", async (req, res) => {
      const taskId = req.params.id;
      const filter = { _id: new ObjectId(taskId) };

      // Data from client
      const updatedTask = req.body;
      console.log("Updated Task from Client:", updatedTask);

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

      console.log("Is Data Matched?", matched);

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
    console.log("MongoDB connection closed.");
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

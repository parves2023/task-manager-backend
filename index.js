const express = require("express");
const cors = require("cors");
require("dotenv").config();
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const app = express();
const port = process.env.PORT || 5000;
const jwt = require('jsonwebtoken');

// app.use(
//   cors({
//     origin: [
//       "https://alorshimana.netlify.app", // Allow production domain
//       "http://localhost:5173", // Allow local development domain
//     ],
//     methods: ["GET", "POST", "PUT","PATCH", "DELETE"], // Allowed HTTP methods
//     allowedHeaders: ["Content-Type","Authorization"], // Allowed headers
//   })
// );

app.use(express.json());
app.use(cors());
  
// const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.mf6ex.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.3tilc.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`; 
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    const usersCollection = client.db("socialDB").collection("socialusers");

    const notesCollection = client.db("socialDB").collection("notes");

    // jwt related api
    app.post("/jwt", async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "1h",
      });
      res.send({ token });
    });

    // middlewares
    const verifyToken = (req, res, next) => {
      // console.log('inside verify token', req.headers.authorization);
      if (!req.headers.authorization) {
        return res.status(401).send({ message: "unauthorized access" });
      }
      const token = req.headers.authorization.split(" ")[1];
      jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
          return res.status(401).send({ message: "unauthorized access" });
        }
        req.decoded = decoded;
        next();
      });
    };

    // POST endpoint for user registration
    app.post("/users", async (req, res) => {
      const { name, email, photo, password, createdAt } = req.body;

      try {
        // Check if user already exists by email
        const existingUser = await usersCollection.findOne({ email });

        if (existingUser) {
          // If the user exists, return a success message
          return res.status(200).json({ message: "User already exists." });
        }

        // Create new user object
        const newUser = {
          name,
          email,
          photo,
          password, // Ensure password is hashed before storing
          createdAt,
        };

        // Insert new user into the collection
        await usersCollection.insertOne(newUser);

        // Respond with success message
        res.status(201).json({ message: "User saved successfully!" });
      } catch (error) {
        console.error("Error saving user:", error);
        res.status(500).json({ error: "Failed to save user." });
      }
    });

    app.get("/users",verifyToken, async (req, res) => {
      const { email } = req.query; // Assume the email is sent in the query parameter

      if (!email) {
        return res.status(400).json({ error: "Email is required" });
      }

      try {
        // Find all users except the current user
        const users = await usersCollection
          .find({ email: { $ne: email } })
          .sort({ createdAt: -1 })
          .toArray();

        res.status(200).json({ users });
      } catch (error) {
        console.error("Error fetching users:", error);
        res.status(500).json({ error: "Failed to fetch users." });
      }
    });


















    /// note related apis

    //  adding a note
    app.post("/addnote", async (req, res) => {
      try {
        const { title, content, userName, userEmail, createdAt, imageUrl,outline,category } =
          req.body;

        if (!title || !content || !userEmail) {
          return res
            .status(400)
            .send({ error: "Title, content, and user email are required." });
        }

        const newNote = {
          title,
          content,
          userName: userName || "Anonymous",
          userEmail,
          createdAt: createdAt || new Date().toISOString(),
          imageUrl: imageUrl || null,
          outline,
          category,
        };

        const result = await notesCollection.insertOne(newNote);
        res.status(201).send({
          success: true,
          message: "Note added successfully",
          noteId: result.insertedId,
        });
      } catch (error) {
        console.error("Error adding note:", error);
        res.status(500).send({ error: "Failed to add note" });
      }
    });

    app.get("/notes",verifyToken, async (req, res) => {
      try {
        const email = req.query.email; // Retrieve the email from the query parameters
        const searchQuery = email
          ? { userEmail: { $regex: new RegExp(email, "i") } }
          : {}; // Case-insensitive email filter

        // Retrieve and sort notes
        const notes = await notesCollection
          .find(searchQuery)
          .sort({ createdAt: -1 })
          .toArray();

        if (!notes || notes.length === 0) {
          return res.status(404).send({ message: "No notes found." });
        }

        res.status(200).send(notes);
      } catch (error) {
        console.error("Error fetching notes:", error);
        res.status(500).send({ error: "Failed to fetch notes" });
      }
    });

    // Example of a DELETE route on the server
    app.delete("/notes/:id", async (req, res) => {
      const { id } = req.params;
      try {
        const result = await notesCollection.deleteOne({
          _id: new ObjectId(id),
        });
        if (result.deletedCount > 0) {
          res.status(200).send({ message: "Note deleted successfully" });
        } else {
          res.status(404).send({ error: "Note not found" });
        }
      } catch (error) {
        res.status(500).send({ error: "Failed to delete note" });
      }
    });

//update by category
    app.patch("/category/:id", async (req, res) => {
      const { id } = req.params;
      const { category } = req.body;
    
      // Validate the ID and category
      if (!ObjectId.isValid(id)) {
        return res.status(400).send({ error: "Invalid note ID" });
      }
      if (!category) {
        return res.status(400).send({ error: "Category is required" });
      }
    
      try {
        const result = await notesCollection.updateOne(
          { _id: new ObjectId(id) },
          { $set: { category } }
        );
    
        // Check if the note was found and updated
        if (result.matchedCount === 0) {
          return res.status(404).send({ error: "Note not found" });
        }
    
        // Send success response
        res.json({ message: "Note updated successfully" });
      } catch (error) {
        console.error("Error updating note:", error);
        res.status(500).send({ error: "Failed to update note" });
      }
    });


    // Update a note
    app.patch('/notes/:id', async (req, res) => {
      const { id } = req.params;
      const { title, content } = req.body;
    
   
    
      try {
        const result = await notesCollection.updateOne(
          { _id: new ObjectId(id) }, // Ensure _id is treated as an ObjectId
          { $set: { title, content } }
        );
    
        if (result.matchedCount === 0) {
          return res.status(404).send({ error: "Note not found" });
        }
    
        res.json({ message: "Note updated successfully" });
      } catch (error) {
        console.error("Error updating note:", error);
        res.status(500).send({ error: "Failed to update note" });
      }
    });


    // Send a ping to confirm a successful connection

    await client.db("admin").command({ ping: 1 });
    // console.log(
    // "Pinged your deployment. You successfully connected to MongoDB!"
    // );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);
 
app.get("/", (req, res) => {
  res.send("note server is running");
});

app.listen(port, () => {
  // console.log(`visa server is running on port: ${port}`);
});

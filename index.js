const express = require("express");
require("dotenv").config();
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

const uri = process.env.MONGODB_CONNECTION_URL;
// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    const db = client.db(process.env.DATABASE_NAME);
    const facilitieCollections = db.collection("facilities");
    const bookingCollection = db.collection("bookings");

    // 1. নতুন ফ্যাসিলিটি যোগ করা (POST)
    app.post("/facilities", async (req, res) => {
      try {
        const facilitieData = req.body;
        const result = await facilitieCollections.insertOne({
          ...facilitieData,
          createdAt: new Date(),
        });
        res.status(201).send({
          success: true,
          message: "Facility added successfully",
          insertedId: result.insertedId,
        });
      } catch (error) {
        res.status(500).send({ success: false, message: error.message });
      }
    });

    // 2. সব ফ্যাসিলিটি গেট করা (GET)
    app.get("/facilities", async (req, res) => {
      try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 6; // প্রতি পেজে ৬টি কার্ড
        const skip = (page - 1) * limit;

        const { search, type } = req.query;
        let query = {};
        if (search) query.name = { $regex: search, $options: "i" };
        if (type && type !== "All") query.type = type;

        const totalCount = await facilitieCollections.countDocuments(query);
        const facilities = await facilitieCollections
          .find(query)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .toArray();

        res.send({
          facilities,
          totalCount,
          totalPages: Math.ceil(totalCount / limit),
          currentPage: page,
        });
      } catch (error) {
        res.status(500).send({ success: false, message: error.message });
      }
    });

    //3.
    app.get("/facilities/:id", async (req, res) => {
      try {
        const id = req.params.id;

        if (!ObjectId.isValid(id)) {
          return res
            .status(400)
            .send({ success: false, message: "Invalid ID" });
        }

        const result = await facilitieCollections.findOne({
          _id: new ObjectId(id),
        });

        if (!result) {
          return res
            .status(404)
            .send({ success: false, message: "Facility not found" });
        }

        res.send(result);
      } catch (error) {
        res.status(500).send({ success: false, message: error.message });
      }
    });

    // 4
    app.post("/booking", async (req, res) => {
      try {
        const bookingData = req.body;

        // ঐ দিন এবং ঐ সময়ে অলরেডি বুকিং আছে কি না চেক করা
        const existingBooking = await bookingCollection.findOne({
          facilityId: bookingData.facilityId,
          date: bookingData.date,
          slot: bookingData.slot,
        });

        if (existingBooking) {
          return res
            .status(400)
            .send({ success: false, message: "This slot is already booked!" });
        }

        const result = await bookingCollection.insertOne({
          ...bookingData,
          status: "Pending", // ডিফল্ট স্ট্যাটাস
          bookedAt: new Date(),
        });

        res.status(201).send({ success: true, insertedId: result.insertedId });
      } catch (error) {
        res.status(500).send({ success: false, message: error.message });
      }
    });

    // 5
    app.get("/booking", async (req, res) => {
      try {
        const { email, status } = req.query;
        let query = {};

        if (email) query.userEmail = email; // শুধুমাত্র লগইন করা ইউজারের ডাটা আসবে
        if (status && status !== "All") {
          // case-insensitive query
          query.status = { $regex: new RegExp(`^${status}$`, "i") };
        }

        const result = await bookingCollection
          .find(query)
          .sort({ bookedAt: -1 })
          .toArray();
        res.send(result);
      } catch (error) {
        res.status(500).send({ success: false, message: error.message });
      }
    });

    

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!",
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  console.log("Server is running");
  res.send("Server is running properly");
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

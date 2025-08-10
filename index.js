const express = require("express");
const { MongoClient } = require("mongodb");
require("dotenv").config(); // Load environment variables

const app = express();

// MongoDB connection URI and DB/collection
const MONGO_URI = "mongodb+srv://pandimuthaiah2006:muthu2006@cluster0.wnkamf8.mongodb.net/college_transport?retryWrites=true&w=majority&appName=Cluster0";
const DB_NAME = "college_transport";
const COLLECTION_NAME = "Location";

// Cache variables
let cacheData = {};
let cacheTimestamp = 0;
const CACHE_TTL = 3 * 60 * 1000; // 3 minutes in ms

// MongoDB client
const client = new MongoClient(MONGO_URI);

async function getDataFromDB(id) {
  const db = client.db(DB_NAME);
  const collection = db.collection(COLLECTION_NAME);
  // Example: get the first document
  return await collection.findOne({_id: id});
}

app.get("/data/:id", async (req, res) => {
  const now = Date.now();
  const { id } = req.params;

  // If cache is still valid, return it
  if (cacheData[id] && now - cacheData[id].timestamp < CACHE_TTL) {
    return res.json({ source: "cache", data: cacheData[id].data });
  }

  try {
    // Connect to MongoDB if not connected
    if (!client.topology?.isConnected()) {
      await client.connect();
    }

    // Fetch from DB
    const data = await getDataFromDB(id);

    // Update cache
    cacheData[id] = { data, timestamp: now };

    res.json({ source: "db", data });
  } catch (err) {
    console.error("Error fetching data:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.listen(process.env.PORT || 3000, () => {
  console.log(`Server running on http://localhost:${process.env.PORT || 3000}`);
});

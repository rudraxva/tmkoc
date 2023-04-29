const mongoose = require("mongoose");

mongoose
  .connect("mongodb://0.0.0.0:27017/e-commerce")
  .then(() => console.log("Connected to MongoDB"))
  .catch((err) => console.error("Error connecting to MongoDB:", err));

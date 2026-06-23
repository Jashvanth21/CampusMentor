require("dotenv").config();
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const User = require("../models/User");

const ADMIN_USER = {
  name: "Super Admin",
  email: "admin@campusmentor.com",
  password: "Qwerty@124",
  role: "admin"
};

const seedAdmin = async () => {
  try {
    if (!process.env.MONGO_URI) {
      throw new Error("MONGO_URI is missing in .env");
    }

    await mongoose.connect(process.env.MONGO_URI);

    const existingAdmin = await User.findOne({ email: ADMIN_USER.email.toLowerCase() }).lean();
    if (existingAdmin) {
      console.log("Admin already exists");
      return;
    }

    const hashedPassword = await bcrypt.hash(ADMIN_USER.password, 10);

    // Insert hashed password directly to keep seeder deterministic.
    await User.collection.insertOne({
      name: ADMIN_USER.name,
      email: ADMIN_USER.email.toLowerCase(),
      password: hashedPassword,
      role: ADMIN_USER.role,
      createdAt: new Date()
    });

    console.log("Admin created successfully");
  } catch (error) {
    console.error("Failed to seed admin:", error.message);
    process.exitCode = 1;
  } finally {
    await mongoose.connection.close();
    process.exit();
  }
};

seedAdmin();

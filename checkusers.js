// checkUsers.js
const mongoose = require('mongoose');
const User = require('./models/User'); // make sure the path is correct

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log("MongoDB Connected"))
.catch((err) => console.error("❌ MongoDB Error:", err.message));

async function fetchUsers() {
  try {
    const users = await User.find(); // fetch all users
    console.log('Users:', users);
    users.forEach(user => {
      console.log(`Name: ${user.name}, Avatar: ${user.avatar}`);
    });
  } catch (err) {
    console.error(err);
  } finally {
    mongoose.connection.close(); // close connection
  }
}

fetchUsers();

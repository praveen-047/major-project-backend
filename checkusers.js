// checkUsers.js
const mongoose = require('mongoose');
const User = require('./models/User'); // make sure the path is correct

// Connect to MongoDB
mongoose.connect('mongodb://localhost:27017/your_database_name', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('✅ Connected to DB'))
.catch(err => console.error('❌ DB connection error:', err));

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

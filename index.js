const express = require('express');
const admin = require('firebase-admin');
const app = express();
const dotenv = require('dotenv');
const cors = require('cors');
const port = process.env.PORT || 5000;
const { MongoClient } = require('mongodb');
const serviceAccount = require('./niche-react-firebase-adminsdk.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

app.use(cors());
app.use(express.json());
dotenv.config();

// Mongo Connection
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@sandbox.5jrgy.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;
const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

async function verifyToken(req, res, next) {
  if (req.headers.authorization?.startsWith('Bearer ')) {
    const token = req.headers.authorization.split(' ')[1];

    try {
      const decodedUser = await admin.auth().verifyIdToken(token);
      req.decodedEmail = decodedUser.email;
    } catch (error) {}
  }
  next();
}

async function run() {
  try {
    await client.connect();
    const database = client.db('nicheDB');
    const usersCollection = database.collection('users');
    const productsCollection = database.collection('products');

    // Save user to mongo
    app.post('/users', async (req, res) => {
      const user = req.body;
      const result = await usersCollection.insertOne(user);
      res.json(result);
    });

    // fecth sigle user
    app.get('/users/:email', async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      let isAdmin = false;
      if (user?.role === 'admin') {
        isAdmin = true;
      }
      res.json({ admin: isAdmin });
    });

    // update user if google sign
    app.put('/users', async (req, res) => {
      const user = req.body;
      const filter = { email: user.email };
      const options = { upsert: true };
      const updateDoc = {
        $set: user,
      };
      const result = await usersCollection.updateOne(
        filter,
        updateDoc,
        options
      );
      res.json(result);
    });

    // Give admin role
    app.put('/addAdmin', verifyToken, async (req, res) => {
      const user = req.body;
      const requester = req.decodedEmail;

      if (requester) {
        const requesterAccount = await usersCollection.findOne({
          email: requester,
        });
        if (requesterAccount.role === 'admin') {
          const filter = { email: user.email };
          const updateDoc = { $set: { role: 'admin' } };
          const result = await usersCollection.updateOne(filter, updateDoc);
          res.json(result);
        }
      } else {
        res
          .status(401)
          .json({ message: 'You are not permitted to do the operation!!!' });
      }
    });

    // Fetch all products
    app.get('/products', async (req, res) => {
      const result = await productsCollection.find({}).toArray();
      res.json(result);
    });

    // Save products to mongo
    app.post('/products', async (req, res) => {
      const product = req.body;
      const result = await productsCollection.insertOne(product);
      res.json(result);
    });
  } finally {
    // await client.close();
  }
}
run().catch(console.dir);

app.get('/', (req, res) => {
  res.send('Hello From Niche Server!');
});

app.listen(port, () => {
  console.log('Listening to port: ', port);
});

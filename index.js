const express = require('express');
const app = express();
const cors = require('cors');
require('dotenv').config();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY)
const cookieParser = require('cookie-parser')
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const jwt = require('jsonwebtoken');

const port = process.env.PORT || 8000;

// middleware
const corsOptions = {
  origin: ['http://localhost:5173', 'http://localhost:5174'],
  credentials: true,
  optionSuccessStatus: 200,
}
app.use(cors(corsOptions))

app.use(express.json())
app.use(cookieParser())

// Verify Token Middleware
const verifyToken = async (req, res, next) => {
  const token = req.cookies?.token
  console.log(token)
  if (!token) {
    return res.status(401).send({ message: 'unauthorized access' })
  }
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      console.log(err)
      return res.status(401).send({ message: 'unauthorized access' })
    }
    req.user = decoded
    next()
  })
}


// const uri = "mongodb+srv://eduFirstUser:NcbFoB1nHCiEzDNg@cluster0.c5gs6mm.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.c5gs6mm.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;


// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();

    const userCollection = client.db('euFirstDB').collection('user');
    const classCollection = client.db('euFirstDB').collection('class');
    const techCollection = client.db('euFirstDB').collection('tech');
    const paymentCollection = client.db('euFirstDB').collection('payment');



    // auth related api
    app.post('/jwt', async (req, res) => {
      const user = req.body
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: '365d',
      })
      res
        .cookie('token', token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict',
        })
        .send({ success: true })
    })
    // Logout
    app.get('/logout', async (req, res) => {
      try {
        res
          .clearCookie('token', {
            maxAge: 0,
            secure: process.env.NODE_ENV === 'production',
            sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict',
          })
          .send({ success: true })
        console.log('Logout successful')
      } catch (err) {
        res.status(500).send(err)
      }
    })

    // save a user data in db
    app.put('/user', async (req, res) => {
      const user = req.body
      const query = { email: user?.email }
      // check if user already exists in db
      const isExist = await userCollection.findOne(query)
      if (isExist) {
        if (user.status === 'pending') {
          // if existing user try to change his role
          const result = await userCollection.updateOne(query, {
            $set: { status: user?.status },
          })
          return res.send(result)
        } else {
          // if existing user login again
          return res.send(isExist)
        }
      }
      const options = { upsert: true }

      // save user for the first time
      const updateDoc = {
        $set: {
          ...user,
          timestamp: Date.now(),
        },
      }
      const result = await userCollection.updateOne(query, updateDoc, options)
      res.send(result)
    })



    // get a user info by email from db
    app.get('/user/:email', async (req, res) => {
      const email = req.params.email
      const result = await userCollection.findOne({ email })
      res.send(result)
    })

    //   get all users data from db
    app.get('/users', async (req, res) => {
      const result = await userCollection.find().toArray()
      res.send(result)
    })

    // admin a user role
    app.patch('/users/makeAdmin/:email', async (req, res) => {
      const email = req.params.email
      const user = req.body
      const query = { email }
      const updateDoc = {
        $set: { ...user, timestamp: Date.now() },
      }
      const result = await userCollection.updateOne(query,updateDoc)
      res.send(result)
    })

   // student class data from db
   app.get('/myClassEnroll', async (req, res)=>{
    const result = await classCollection.find().toArray()
      res.send(result)
   })




    // on all Class data from db

    app.get('/allClass', async (req, res)=>{
      const result = await classCollection.find().toArray()
      res.send(result)
    })

    app.patch('/allClass/:techerEmail', async(req, res) =>{
      const email =req.params.techerEmail;
      const query = {email: email}
      const updateRole ={
        $set: {        
          status: 'approved'
        }
      }
      const result = await classCollection.updateOne(query,updateRole)
      res.send({result})
    })

  
    app.patch('/allReject/:email',  async(req,res)=>{
      const email =req.params.email;
      const query = {email: email}
      const updateDoc ={
        $set: {
          status: 'Rejected'
        }
      }
      const result = await classCollection.updateOne(query, updateDoc)
      res.send(result)

    })

    app.get('/allClassCard/accepted', async (req, res)=>{
      const result = await classCollection.find({status: 'approved'}).toArray()
      res.send(result)
    })

   app.get('/allClassCard/:id', async(req,res)=>{
    const id = req.params.id;
    const query = {_id: new ObjectId(id)}
    const result = await classCollection.findOne(query)
    res.send(result)
   })

   app.get('/payment/:id', async(req,res)=>{
    const id = req.params.id;
    const query = {_id: new ObjectId(id)}
    const result = await classCollection.findOne(query)
    res.send(result)
   })


     //Techer request ......................
    app.get('/addteach', async (req, res)=>{
      const result = await techCollection.find().toArray()
      res.send(result)
    })
  
    



    app.patch('/addteach/:id/:techerEmail', async(req, res) =>{
      const id = req.params.id;
      const email =req.params.techerEmail;
      const filter ={_id: new ObjectId(id)}
      const updateDoc ={
        $set: {
          role: 'techer',
          status: 'accepted'
        }
      }
      const result = await techCollection.updateOne(filter, updateDoc)

      const query = {email: email}
      const updateRole ={
        $set: {
          role: 'techer',
          status: 'Accepted'
        }
      }
      const userRole = await userCollection.updateOne(query,updateRole)
      res.send({result, userRole})
    })

    app.put('/addteach', async (req, res) => {
      const teach = req.body;
      console.log('all teach', teach)
      const result = await techCollection.insertOne(teach)
      res.send(result)
    });


    app.patch('/addteach/:id/:techerEmail', async (req, res) => {
      const id = req.params.id;
      console.log(id)
      const email =req.params.techerEmail;
      console.log(email)
      const filter = { _id: new ObjectId(id) }
      const result = await techCollection.deleteOne(filter)

      const query = {email: email}
      const userRole = await userCollection.deleteOne(query)

      res.send(result, userRole)
    })

    app.delete('/allClass/:id',  async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) }
      const result = await classCollection.deleteOne(query);
      res.send(result);
    })




    // techer collection 
    app.get('/class', async (req, res) => {
      const category = req.query.category
      console.log(category)
      const result = await classCollection.find(category).toArray()
      res.send(result)
    })

    // Get a single class data from db using _id
    app.get('/myClass/:email', async (req, res) => {
      const email = req.params.email
      let query = { 'techer.email': email }
      const result = await classCollection.find(query).toArray()
      res.send(result)
    })

    app.patch('/myClass/:id', async (req, res) => {
      const item = req.body;
      console.log(item)
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) }
      const updateDoc = {
        $set: {
          title: item.title,
          name: item.name,
          category: item.category,
          price: item.price,
          recipe: item.recipe,
          image: item.image
        }
      }

      const result = await classCollection.updateOne(filter, updateDoc)
      res.send(result)
    })


    app.delete('/myClass/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) }
      const result = await classCollection.deleteOne(query)
      res.send(result)
    })


    app.post('/class', async (req, res) => {
      const classes = req.body;
      console.log('all class', classes)
      const result = await classCollection.insertOne(classes);
      res.send(result);
    })

   //payment Intent
   app.post('/create-payment-intent', async (req, res) => {
    const { price } = req.body;
    const amount = parseInt(price * 100);
    console.log(amount, 'amount inside the intent')
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amount,
      currency: 'usd',
      payment_method_types: ['card']
    });
    res.send({
      clientSecret: paymentIntent.client_secret,
    })
  })


  app.post('/payments/:id', async (req, res) => {
    const payment = req.body;
    const paymentResult = await paymentCollection.insertOne(payment);
    console.log('payment infoo', payment)

    //carefully delete each item from the cart
    const query = { _id: new ObjectId (id)}
    const deleteResult = await classCollection.deleteOne(query)


    //carefully delete each item from the cart
    res.send({ paymentResult, deleteResult })
  })

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);



app.get('/', (req, res) => {
  res.send('education all!')
})

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})
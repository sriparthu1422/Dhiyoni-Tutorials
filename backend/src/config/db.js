import mongoose from 'mongoose';

// Global is used here to maintain a cached connection across serverless invocations
let cached = global.mongoose;

if (!cached) {
  cached = global.mongoose = { conn: null, promise: null };
}

const connectDB = async () => {
  if (cached.conn) {
    return cached.conn;
  }

  if (!cached.promise) {
    // Disable buffering so queries fail immediately if connection is down/blocked
    mongoose.set('bufferCommands', false);
    
    cached.promise = mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 5000, // Timeout select server after 5s
    }).then((mongoose) => {
      console.log(`MongoDB Connected: ${mongoose.connection.host}`);
      return mongoose;
    });
  }
  
  try {
    cached.conn = await cached.promise;
  } catch (e) {
    cached.promise = null;
    console.error(`Database connection error: ${e.message}`);
    throw e;
  }

  return cached.conn;
};

export default connectDB;

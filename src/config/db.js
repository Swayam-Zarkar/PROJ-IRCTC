const mongoose=require('mongoose');

async function connectDB()
{
    try
    {
        const connectionobject=await mongoose.connect(`${process.env.MONGO_URL}/${process.env.MONGO_DATABASE}`);
        console.log("database connected successfully at host:",connectionobject.connection.host);
    }
    catch(err)
    {
        console.log("something went wrong when connecting to database",err);
    }
}

module.exports=connectDB;
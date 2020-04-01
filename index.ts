import path from "path";
require('dotenv').config({ path: path.join(process.cwd(), '.env') })

import * as mongo from "mongodb";
const MongoClient = mongo.MongoClient;
const uri = process.env.CONNECTION || ""

const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });


async function insertAndReadData() {
    try {
        await client.connect();
        const db = client.db("test");
        await db.collection("inventory").deleteMany({});
        const result = await db.collection('inventory').insertOne({
            item: "canvas",
            qty: 100,
            tags: ["cotton"],
            size: { h: 28, w: 35.5, uom: "cm" }
        })
        let results = await db.collection('inventory').find({}).toArray();
        //cursor.forEach((data) =>{if(data){console.log(data)}}, (err) => {if(err){console.log(err)}})
        console.log(results)
    } catch (err) {
        console.log("UPPS --->", err)
    }
    finally {
        client.close();
        console.log("Connection Closed")
    }
}


async function connectSetupDataAndGetDB() {
    await client.connect();
    const db = client.db("test");
    await db.collection('inventory').deleteMany({});
    await db.collection('inventory').insertMany([
        {
            item: "journal",
            qty: 25,
            size: { h: 14, w: 21, uom: "cm" },
            status: "A"
        },
        {
            item: "notebook",
            qty: 50,
            size: { h: 8.5, w: 11, uom: "in" },
            status: "A"
        },
        {
            item: "paper",
            qty: 100,
            size: { h: 8.5, w: 11, uom: "in" },
            status: "D"
        },
        {
            item: "planner",
            qty: 75, size: { h: 22.85, w: 30, uom: "cm" },
            status: "D"
        },
        {
            item: "postcard",
            qty: 45,
            size: { h: 10, w: 15.25, uom: "cm" },
            status: "A"
        }
    ])
    return db;
}
async function readDataWithQueries() {
    try {
        const db = await connectSetupDataAndGetDB();
        let results = await db.collection('inventory').find({ status: "D" }).toArray();
        console.log(results);

        results = await db.collection('inventory').find({
            size: { h: 14, w: 21, uom: "cm" }
        }).toArray();
        console.log("Specific measurements:", results);
        results = await db.collection('inventory').find({
            "size.uom": "in"
        }).toArray();
        console.log("Specific uom:", results);
    } catch (err) {
        console.log("UPPS --->", err)
    }
    finally {
        client.close();
        console.log("Closes connection")
    }
}

async function readWithOptions() {
    try {
        const db = await connectSetupDataAndGetDB();
        let results = await db.collection("inventory").find(
            {},
            {
                projection: { _id: 0, item: 1, qty: 1 },
                limit: 3,
                sort: { qty: -1 }
            }
        ).toArray();
        console.log(results);
    } catch (err) {
        console.log("UPPS --->", err)
    }
    finally {
        client.close();
        console.log("Closes connection")
    }
}

async function readDataWithOperatorsAndCompoundQueries() {
    try {
        const db = await connectSetupDataAndGetDB();
        let results = await db.collection('inventory').find({
            "size.h": { $lt: 15 }
        }).toArray();
        //console.log("1:", results);

        results = await db.collection('inventory').find({
            status: "A",
            qty: { $lt: 30 }
        }).toArray();
        //console.log("2", results);

        results = await db.collection('inventory').find({
            $or: [{ status: "A" }, { qty: { $lt: 30 } }]
        }).toArray();
        console.log("3", results);

    } catch (err) {
        console.log("UPPS --->", err)
    }
    finally {
        client.close();
        console.log("Closes connection")
    }
}

async function updateData() {
    try {
        const db = await connectSetupDataAndGetDB();
        //Instead of using updateOne()
        let result = await db.collection('inventory').findOneAndUpdate(
            { item: "paper" },
            {
                $set: { "size.uom": "cm", status: "P" },
                $currentDate: { lastModified: true }
            },
            { returnOriginal: false })
        //console.log(result.value);

        let results = await db.collection('inventory').updateMany(
            { qty: { $lt: 50 } },
            {
                $set: { "size.uom": "in", status: "P" },
                $currentDate: { lastModified: true }
            })
        // console.log("2a", results.result);
        // console.log("----------------------------------------------------------------\n");
        console.log("2b", results.modifiedCount);

    } catch (err) {
        console.log("UPPS --->", err)
    }
    finally {
        client.close();
        console.log("Closes connection")
    }

}
async function deleteData() {
    try {
        const db = await connectSetupDataAndGetDB();
        let result = await db.collection('inventory').findOneAndDelete({
            status: "D"
        })
        console.log("Result of deletion #1:", result.value);

        let results = await db.collection('inventory').deleteMany({
            status: "A"
        })
        console.log("Amount deleted:", results.deletedCount);
    } catch (err) {
        console.log("UPPS --->", err)
    }
    finally {
        client.close();
        console.log("Closes connection")
    }
}
// insertAndReadData();
// readDataWithQueries();
// readWithOptions();
// readDataWithOperatorsAndCompoundQueries();
// updateData()
deleteData()
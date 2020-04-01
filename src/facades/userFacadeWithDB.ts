const path = require('path')
require('dotenv').config({ path: path.join(process.cwd(), '.env') })
import IGameUser from '../interfaces/GameUser';
import { bcryptAsync, bcryptCheckAsync } from "../utils/bcrypt-async-helper"
import * as mongo from "mongodb"
import setup from "../config/setupDB"
import { ApiError } from "../errors/apiError"

let userCollection: mongo.Collection;

export default class UserFacade {

    static async setDatabase(client: mongo.MongoClient) {
        const dbName = process.env.DB_NAME;
        if(!dbName){
            throw new Error("Database name not provided")
        }
        try {
            if(!client.isConnected()){
              await client.connect();
            }
            userCollection =  client.db(dbName).collection("users");
            await userCollection.createIndex( {userName:1}, {unique:true} )
            return client.db(dbName);

        } catch (err) {
            console.error("Could not create connect", err)
        }
    }

    static async addUser(user: IGameUser): Promise<string> {
        const hash = await bcryptAsync(user.password);
        let newUser = { ...user, password: hash }
        const result = await userCollection.insertOne(newUser);
        return "User was added";
    }
    static async deleteUser(userName: string): Promise<string> {
        const deleteResult = await userCollection.findOneAndDelete({userName});
        if (!deleteResult.value) {
            throw new ApiError("Could not delete user", 404);
        }
        return "User deleted";
    }
    //static async getAllUsers(): Promise<Array<IGameUser>> {
    static async getAllUsers(): Promise<Array<any>> {
        const all = userCollection.find(
            {},
            //{projection:{password: 0}}
            {projection:{name: 1, userName: 1}}
            );
        return all.toArray();
    }

    static async getUser(userName: string, proj?:object): Promise<any> {
        const user = await userCollection.findOne(
            {userName},
            {projection:proj}
            );
        if (!user) {
            throw new ApiError("User not found", 404);
        }
        return user;
    }

    static async checkUser(userName: string, password: string): Promise<boolean> {
        let userPassword = "";
        try{
            const user = await UserFacade.getUser(userName);
          userPassword = user.password;
        } catch(err) {
            throw err;
        }
        const status = await bcryptCheckAsync(password, userPassword);
        return status
    }
}

async function test() {
    console.log("testing")
    const client = await setup();
    await UserFacade.setDatabase(client)
    await userCollection.deleteMany({})
    await UserFacade.addUser({ name: "kim", userName: "kim@b.dk", password: "secret", role: "user" })
    await UserFacade.addUser({ name: "ole", userName: "ole@b.dk", password: "secret", role: "user" })
    
    const all = await UserFacade.getAllUsers();
    // console.log(all)

    const projection = {_id:0, role:0,password:0}
    const kim = await UserFacade.getUser("kim@b.dk",projection)
    console.log(kim)

    
    try {
        const passwordStatus = await UserFacade.checkUser("kim@b.dk", "secret");
        console.log("Expects true: ", passwordStatus)
    } catch (err) {
        console.log("Should not get here 1", err)
    }
    try {
        const passwordStatus = await UserFacade.checkUser("kim@b.dk", "xxxx");
        console.log("Should not get here ", passwordStatus)
    } catch (err) {
        console.log("Should get here with failded 2", err)
    }
    try {
        const passwordStatus = await UserFacade.checkUser("xxxx@b.dk", "secret");
        console.log("Should not get here")
    } catch (err) {
        console.log("Should get here with failded 2", err)
    }
    // client.close();
    try {
        let status = await UserFacade.deleteUser("kim@b.dk");
        console.log(status)
        status = await UserFacade.deleteUser("xxxx@b.dk");
        console.log("Should not get here")
    } catch (err) {
        console.log(err.message)
    }
    
}
//test();

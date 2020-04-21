const path = require('path')
require('dotenv').config({ path: path.join(process.cwd(), '.env') })
import IPoint from '../interfaces/Point';
import * as mongo from "mongodb"
import { ApiError } from "../errors/apiError"
import UserFacade from "./userFacadeWithDB"
import IPosition from '../interfaces/Position';
import IPost from '../interfaces/Post';
import { positionCreator } from "../utils/geoUtils"
import { POSITION_COLLECTION_NAME, POST_COLLECTION_NAME } from "../config/collectionNames"
import { type } from 'os';

let positionCollection: mongo.Collection;
let postCollection: mongo.Collection;
const EXPIRES_AFTER = 30;

export default class GameFacade {

  static readonly DIST_TO_CENTER = 15

  static async setDatabase(client: mongo.MongoClient) {
    const dbName = process.env.DB_NAME;
    if (!dbName) {
      throw new Error("Database name not provided")
    }
    //This facade uses the UserFacade, so set it up with the right client
    await UserFacade.setDatabase(client);

    try {
      if (!client.isConnected()) {
        await client.connect();
      }
      positionCollection = client.db(dbName).collection(POSITION_COLLECTION_NAME);
      //TODO
      //1) Create expiresAfterSeconds index on lastUpdated
      await positionCollection.createIndex({ "lastUpdated": 1 }, { expireAfterSeconds: EXPIRES_AFTER })
      //2) Create 2dsphere index on location
      await positionCollection.createIndex({ location: "2dsphere" })
      //3) Create unique index for userName since it's unique in the userCollection and is going to be used and searched for a lot
      await positionCollection.createIndex({ userName: 1 }, { unique: true })

      //TODO uncomment if you plan to do this part of the exercise
      postCollection = client.db(dbName).collection(POST_COLLECTION_NAME);
      //TODO If you do this part, create 2dsphere index on location
      await postCollection.createIndex({ location: "2dsphere" })
      return client.db(dbName);

    } catch (err) {
      console.error("Could not connect", err)
    }
  }

  static async nearbyPlayers(userName: string, password: string, longitude: number, latitude: number, distance: number): Promise<Array<any>> {
    let user;
    try {
      //Step-1. Find the user, and if found continue
      // Use relevant methods in the user facad>
      const loginSuccess = await UserFacade.checkUser(userName, password);
      if (!loginSuccess) throw new ApiError("wrong username or password", 403);
      user = await UserFacade.getUser(userName);
    } catch (err) {
      //Maybe change this later
      throw err;
    }

    try {
      //If loggedin update (or create if this is the first login) his position
      const point = { type: "Point", coordinates: [longitude, latitude] }
      const date = new Date();
      //Todo
      /*It's important you know what to do her. Remember a document for this user does
        not neccesarily exist. If not, you must create it, in not found (see what you can do wit upsert)
        Also remember to set a new timeStamp (use the date create above), since this document should only live for a
        short time */
      const position: IPosition = {
        userName,
        name: user.name,
        lastUpdated: date,
        location: point
      }
      const found = await positionCollection.findOneAndUpdate(
        { userName }, //Add what we are searching for (the userName in a Position Document)
        {
          $set: { position }
        },
        // upsert creates the document, if it does not exist already
        { upsert: true, returnOriginal: false }
      )


      /* TODO 
         By now we have updated (or created) the callers position-document
         Next step is to see if we can find any nearby players, friends or whatever you call them
         */
      const nearbyPlayers = await GameFacade.findNearbyPlayers(userName, point, distance);

      //If anyone found,  format acording to requirements
      const formatted = nearbyPlayers.map((player) => {
        return {
          userName: player.userName,
          name: player.name,
          lon: player.location.coordinates[0],
          lat: player.location.coordinates[1]
        }
      })
      return formatted
    } catch (err) {
      throw err;
    }
  }

  static async findNearbyPlayers(clientUserName: string, point: IPoint, distance: number): Promise<Array<IPosition>> {
    try {
      const found = positionCollection.find(
        {
          userName: { $ne: clientUserName },
          location:
          {
            $near:
            {
              $geometry: point,
              $maxDistance: distance
            }
          }
        }
      )
      return found.toArray();
    } catch (err) {
      throw err;
    }
  }

  static async updatePosition(userName: string, lat: number, lon: number): Promise<any> {
    const point = { type: "Point", coordinates: [lon, lat] }
    const date = new Date();
    try {
      const found = await positionCollection.findOneAndUpdate(
        { userName }, //Add what we are searching for (the userName in a Position Document)
        {
          $set: {
            lastUpdated: date,
            userName,
            location: point
          }
        },
        //upsert is not necessary. Only use this endpoint if document already exists
        { /* upsert: true, */ returnOriginal: false }
      )
      if (found.value == null) {
        throw new ApiError("No position found. Could not update", 400);
      }
      const formatted: IPosition = {
        lastUpdated: found.value.lastUpdated,
        userName: found.value.userName,
        name: found.value.name,
        location: found.value.location
      }
      return formatted;
    } catch (err) {
      throw err;
    }
  }

  static async getPostIfReached(postId: string, lat: number, lon: number): Promise<any> {
    try {
      const post: IPost | null = await postCollection.findOne(
        {
          _id: postId,
          location:
          {
            $near:
            {
              $geometry: {
                type: "Point",
                coordinates: [lon, lat]
              },
              $maxDistance: this.DIST_TO_CENTER
            }
          }
        }
      )
      if (post === null) {
        throw new ApiError("Post not reached", 400);
      }
      return { postId: post._id, task: post.task.text, isUrl: post.task.isUrl };
    } catch (err) {
      throw err;
    }

  }

  //You can use this if you like, to add new post's via the facade
  static async addPost(
    name: string,
    taskTxt: string,
    isURL: boolean,
    taskSolution: string,
    lon: number,
    lat: number
  ): Promise<IPost> {
    const position = { type: "Point", coordinates: [lon, lat] };
    const status = await postCollection.insertOne({
      _id: name,
      task: { text: taskTxt, isURL },
      taskSolution,
      location: position
    });
    const newPost: any = status.ops;
    return newPost as IPost
  }
}


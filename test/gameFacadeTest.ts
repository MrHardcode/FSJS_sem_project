import * as mongo from "mongodb"
const MongoClient = mongo.MongoClient;
import setup from "../src/config/setupDB"
//import UserFacade from '../src/facades/userFacadeWithDB';
import GameFacade from '../src/facades/gameFacade';
import { expect } from "chai";
import { bcryptAsync } from "../src/utils/bcrypt-async-helper"
import { positionCreator, getLatitudeOutside, getLatitudeInside } from "../src/utils/geoUtils"
import { USER_COLLECTION_NAME, POSITION_COLLECTION_NAME, POST_COLLECTION_NAME } from "../src/config/collectionNames"
import { ApiError } from '../src/errors/apiError';

let userCollection: mongo.Collection | null;
let positionCollection: mongo.Collection | null;
let postCollection: mongo.Collection | null;

let client: mongo.MongoClient;
const DISTANCE_TO_SEARCH = 100

describe("Verify the GameFacade", () => {

  before(async () => {
    client = await setup();
    process.env["DB_NAME"] = "semester_case_test"
    const db = await GameFacade.setDatabase(client)

    if (!db) {
      throw new Error("Database not intialized")
    }
    userCollection = db.collection(USER_COLLECTION_NAME);
    positionCollection = db.collection(POSITION_COLLECTION_NAME)
    postCollection = db.collection(POST_COLLECTION_NAME);

    if (userCollection === null || positionCollection === null) {
      throw new Error("user and/or location- collection not initialized")
    }

  })
  after(async () => {
    await client.close();
  })
  beforeEach(async () => {
    if (userCollection === null || positionCollection === null || postCollection === null) {
      throw new Error("One of requred collections is null")
    }
    await userCollection.deleteMany({})
    const secretHashed = await bcryptAsync("secret");
    const team1 = { name: "Team1", userName: "t1", password: secretHashed, role: "team" }
    const team2 = { name: "Team2", userName: "t2", password: secretHashed, role: "team" }
    const team3 = { name: "Team3", userName: "t3", password: secretHashed, role: "team" }
    await userCollection.insertMany([team1, team2, team3])

    await positionCollection.deleteMany({})

    const positions = [
      positionCreator(12.48, 55.77, team1.userName, team1.name, true),
      //TODO --> Change latitude below, to a value INSIDE the radius given by DISTANCE_TO_SEARC, and the position of team1
      positionCreator(12.48, getLatitudeInside(55.77, DISTANCE_TO_SEARCH), team2.userName, team2.name, true),
      //TODO --> Change latitude below, to a value OUTSIDE the radius given by DISTANCE_TO_SEARC, and the position of team1
      positionCreator(12.48, getLatitudeOutside(55.77, DISTANCE_TO_SEARCH), team3.userName, team3.name, true),
    ]
    await positionCollection.insertMany(positions)

    //Only include this if you plan to do this part 
    await postCollection.deleteMany({})
    await postCollection.insertOne({
      _id: "Post1",
      task: { text: "1+1", isUrl: false },
      taskSolution: "2",
      location: {
        type: "Point",
        coordinates: [12.49, 55.77]
      }
    });

  })

  describe("Verify nearbyPlayers", () => {
    it("Should find (Only) Team2", async () => {
      const playersFound = await GameFacade.nearbyPlayers("t1", "secret", 12.48, 55.77, DISTANCE_TO_SEARCH)
      expect(playersFound.length).to.be.equal(1);
      expect(playersFound[0].userName).to.be.equal("t2")
    })
  })

  describe("Verify updatePosition", () => {
    it("Should update the position of Team1", async () => {
      const result = await GameFacade.updatePosition("t1", 12.48, 55.87);
      expect(result.name).to.be.equal("Team1");
      expect(result.userName).to.be.equal("t1");
      expect(result.location.type).to.be.equal("Point");
    })
  })

  describe("Verify updatePosition", () => {
    it("Should not update the position of non-existing user", async () => {
      try {
        const result = await GameFacade.updatePosition("t20", 12.48, 55.79);
        throw new Error("Should NEVER get here")
      } catch (err) {
        console.log(err);
        expect(err.errorCode).to.be.equal(400)
        expect(err.message).to.be.equal("No position found. Could not update")
      }

    })
  })

  describe("Verify nearbyPlayers", () => {
    it("Should not find Team2 (wrong credentials)", async () => {
      try {
        const playersFound = await GameFacade.nearbyPlayers("t1", "xxxxx", 12.48, 55.77, DISTANCE_TO_SEARCH)
        throw new Error("Should NEVER get here")
      } catch (err) {
        expect(err.errorCode).to.be.equal(403)
      }

    })
  })

  describe("Verify nearbyPlayers", () => {
    xit("Should find Team2 and Team2", async () => {
      //TODO
      console.log("What");
    })
  })

  describe("Verify getPostIfReached", () => {
    it("Should find the post since it was reached", async () => {
      try {
        const postFound = await GameFacade.getPostIfReached("Post1", 12.49, 55.77);
        expect(postFound.task).to.be.equal("1+1");
        expect(postFound.isUrl).to.be.equal(false);
      } catch (err) {
        console.log(err);
      }
    })

    it("Should NOT find the post since it was NOT reached", async () => {
      try {
        const postFound = await GameFacade.getPostIfReached("Post1", 12.49, 55.77);
        expect(postFound.task).to.be.equal(undefined);
      } catch (err) {
        expect(err instanceof ApiError).to.be.equal(true)
        expect(err.message).to.be.equal("Post not reached")
      }
    })
  })
})
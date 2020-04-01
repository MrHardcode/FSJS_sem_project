import * as bcrypt from "bcryptjs";
const SALT_ROUNDS = 10;

const bcryptAsync = (password: string): Promise<string> => {
    return new Promise((resolve, reject) => {
        bcrypt.genSalt(SALT_ROUNDS, function (err, salt) {
            bcrypt.hash(password, salt, function (err, hash) {
                if (err) {
                    reject(err);
                }
                return resolve(hash)
            })
        })
    })
}

const bcryptCheckAsync = (password: string, hashed: string): Promise<boolean> => {
    return new Promise((resolve, reject) => {
        bcrypt.compare(password, hashed, function (err, res) {
            if (err || !res) {
                //Used to reject promise but that makes no sense to me and JS literally says:
                // "Error: Promise rejected with no or falsy reason" when the promise is rejected in here
                resolve(false);
            }
            return resolve(true)
        })
    })
}
export {bcryptAsync,bcryptCheckAsync}
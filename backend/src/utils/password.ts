import bcrypt from "bcrypt";
import { config } from "../config/index";


export const hashPassword = async (password: string): Promise<string> => {
    return bcrypt.hash(password, config.auth.bcrypt.saltRounds);
}

export const comparePassword = async (password: string, hash: string): Promise<boolean> => {
    return bcrypt.compare(password, hash);
}
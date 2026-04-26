import type { Request, Response } from "express";
import {handleCallback, getGithubUserData, createOrUpdateUser} from '../services/auth.service.js';

1
export function getGithubAuthCode(req:Request, res:Response) {
   const url = `https://github.com/login/oauth/authorize?client_id=${process.env.GITHUB_CLIENT_ID}&scope=user:email`;
   res.redirect(url);
}


export async function handleCallbackController(req:Request, res:Response) {
    const code = req.query.code as string;

    const tokenResponse = await handleCallback(code);
    console.log('token in controller', tokenResponse);

    const userDataFromGithub = await getGithubUserData(tokenResponse.access_token);
    console.log('user data in controller', userDataFromGithub);

    const userData = {
        github_id: userDataFromGithub.id,
        username: userDataFromGithub.login,
        email: userDataFromGithub.email,
        avatar_url: userDataFromGithub.avatar_url
    }

    const createdUser = await createOrUpdateUser(userData);
    console.log('created user in controller', createdUser);

    if(createdUser instanceof Error) {
        console.log(createdUser.message);
        return res.status(500).json({message: "Internal server error"})
    }

    return res.status(200).json({message: "User created successfully", user: createdUser})

}


export function getRefreshToken(req:Request, res:Response) {
        res.json({message: "successful refresh token"})
}


export function handleLogout(req:Request, res:Response) {
        res.json({message: "successful logout"})
}
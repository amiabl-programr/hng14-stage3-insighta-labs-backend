import type { Request, Response } from "express";
import {handleCallback, getGithubUserData, createOrUpdateUser} from '../services/auth.service.js';
import { catchAsync } from '../utils/catchAsync.js';
import { sendSuccessResponse } from '../utils/responseHandler.js';

export const getGithubAuthCode = catchAsync(async (req:Request, res:Response) => {
   const url = `https://github.com/login/oauth/authorize?client_id=${process.env.GITHUB_CLIENT_ID}&scope=user:email`;
   res.redirect(url);
});

export const handleCallbackController = catchAsync(async (req:Request, res:Response) => {
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

    return sendSuccessResponse(res, 200, "User created successfully", createdUser);
});

export const getRefreshToken = catchAsync(async (req:Request, res:Response) => {
    return sendSuccessResponse(res, 200, "successful refresh token");
});

export const handleLogout = catchAsync(async (req:Request, res:Response) => {
    return sendSuccessResponse(res, 200, "successful logout");
});
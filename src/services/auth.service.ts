import {saveUser} from '../models/auth.model.js';

export async function handleCallback(code:string) {
    const response = await fetch("https://github.com/login/oauth/access_token", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Accept": "application/json"
        },
        body: JSON.stringify({
            code,
            client_id: process.env.GITHUB_CLIENT_ID,
            client_secret: process.env.GITHUB_CLIENT_SECRET
        })
    })
    const tokenData = await response.json();
    return tokenData;
}

export async function getGithubUserData(token:string) {
    const response = await fetch("https://api.github.com/user", {
        headers: {
            "Authorization": `token ${token}`
        }
    })
    const userData = await response.json();
    return userData;
}

export interface GithubUserData {
    github_id: number;
    username: string;
    email: string | null;
    avatar_url: string;
}

export async function createOrUpdateUser(userData: GithubUserData) {
    try {
        const user = await saveUser(userData);
        return user;
    } catch(err: unknown) {
        console.log((err as Error).message);
        throw err;
    }
}
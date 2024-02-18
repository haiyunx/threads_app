"use server"

//import the revalidatePath function from the next/cache package
import { revalidatePath } from "next/cache";
//import the User model from the mongoose package
import User from "../models/user.model";
//import the connectToDB function from the mongoose package
import { connectToDB } from "../mongoose";
import Thread from "../models/thread.model";
import { FilterQuery, SortOrder } from "mongoose";

//interface for the Params object
interface Params {
    userId: string;
    username: string;
    name: string;
    bio: string;
    image: string;
    path: string;
  }
  
  //export an async function called updateUser that takes in a Params object
export async function updateUser({
userId,
bio,
name,
path,
username,
image,
}: Params): Promise<void> {
//connect to the database
connectToDB();

try {
    //find the user with the given userId and update the username, name, bio, image, and onboarded fields
    await User.findOneAndUpdate(
        { id: userId },
        {
        username: username.toLowerCase(),
        name,
        bio,
        image,
        onboarded: true,
        },
        { upsert: true}
    );

    //if the path is "/profile/edit", revalidate the path
    if(path === "/profile/edit"){
        revalidatePath(path);
    }

} catch (error: any) {
    //throw an error if the user fails to create/update
    throw new Error(`Failed to create/update user: ${error.message}`)
}
}

export async function  fetchUser(userId: string) {
    try{
        connectToDB();

        return await User
            .findOne({ id: userId })
        //    .populate({
        //        path: 'community',
        //        model: Community
        //    })
    } catch (error: any) {
        throw new Error(`Failed to fetch user: ${error.message}`)
    }
}

export async function fetchUserPosts(userId: string) {
    try{
        connectToDB();

        //Find all threads authored by user with the given userId

        //TODO: Populate community
        const threads = await User.findOne({ id: userId })
        .populate({
            path: 'threads',
            model: Thread,
            populate: {
                path: 'children',
                model: Thread,
                populate: {
                    path: 'author',
                    model: User,
                    select: 'name image id'
                }
            }
        })

        return threads;
    } catch (error: any) {
        throw new Error(`Failed to fetch user posts: ${error.message}`)
    }
}

export async function fetchUsers({
    userId,
    searchString="",
    pageNumber = 1,
    pageSize = 20,
    sortBy = "desc"
} : {
    userId: string,
    searchString?:string;
    pageNumber?:number;
    pageSize?:number;
    sortBy?: SortOrder; //comes from mongoose
}){
    try {
        connectToDB();

        const skipAmount = (pageNumber-1)*pageSize;

        const regex = new RegExp(searchString, "i"); //"i" means case insensitive

        const query: FilterQuery<typeof User> = { //to have the $or object you have to define this as a FilterQuery
            id: { $ne: userId} //$ne means not equal to
        }

        if(searchString.trim() !==''){
            query.$or = [ //append a query
                { username: { $regex: regex}},
                { name: { $regex: regex}}
            ]
        }

        const sortOptions = {createdAt: sortBy};

        const usersQuery = User.find(query)
            .sort(sortOptions)
            .skip(skipAmount)
            .limit(pageSize);
        
            const totalUsersCount = await User.countDocuments(query);

            const users = await usersQuery.exec();

            const isNext = totalUsersCount > skipAmount + users.length;

            return { users, isNext};
    } catch (error: any) {
        throw new Error(`Failed to fetch users: ${error.message}`)
    }
}

export async function getActivity(userId: string) {
    try {
        connectToDB();

        // find all thread created by the user
        const userThreads = await Thread.find({ author: userId });

        // collect all the child thread ids (replies) from the 'children' field
        const childThreadIds = userThreads.reduce((acc, userThread) => {
            return acc.concat(userThread.children)
        },[])

        // find all the threads that the user has replied to
        const replies = await Thread.find({
            _id: { $in: childThreadIds},
            author:  {$ne: userId },
        }).populate({
            path: 'author',
            model: User,
            select: 'name image _id'        
        })

        return replies;
    } catch (error: any) {
        throw new Error(`Failed to fetch activity: ${error.message}`)
    }
}
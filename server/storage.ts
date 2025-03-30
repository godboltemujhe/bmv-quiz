import { users, type User, type InsertUser, quizzes, type Quiz, type InsertQuiz } from "@shared/schema";
import { v4 as uuidv4 } from 'uuid';
import { drizzle } from 'drizzle-orm/neon-serverless';
import { neon } from '@neondatabase/serverless';
import { eq, and, ne } from 'drizzle-orm';

// modify the interface with any CRUD methods
// you might need

export interface IStorage {
  // User methods
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Quiz methods
  getQuiz(id: number): Promise<Quiz | undefined>;
  getQuizByUniqueId(uniqueId: string): Promise<Quiz | undefined>;
  getAllQuizzes(): Promise<Quiz[]>;
  getPublicQuizzes(): Promise<Quiz[]>;
  createQuiz(quiz: InsertQuiz): Promise<Quiz>;
  updateQuiz(id: number, quiz: Partial<InsertQuiz>): Promise<Quiz | undefined>;
  deleteQuiz(id: number): Promise<boolean>;
  syncQuizzes(quizzesToSync: InsertQuiz[]): Promise<Quiz[]>;
}

// In-memory storage for development
export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private quizCollection: Map<number, Quiz>;
  userCurrentId: number;
  quizCurrentId: number;

  constructor() {
    this.users = new Map();
    this.quizCollection = new Map();
    this.userCurrentId = 1;
    this.quizCurrentId = 1;
  }

  // User methods
  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.userCurrentId++;
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }
  
  // Quiz methods
  async getQuiz(id: number): Promise<Quiz | undefined> {
    return this.quizCollection.get(id);
  }
  
  async getQuizByUniqueId(uniqueId: string): Promise<Quiz | undefined> {
    return Array.from(this.quizCollection.values()).find(
      (quiz) => quiz.uniqueId === uniqueId
    );
  }
  
  async getAllQuizzes(): Promise<Quiz[]> {
    return Array.from(this.quizCollection.values());
  }
  
  async getPublicQuizzes(): Promise<Quiz[]> {
    return Array.from(this.quizCollection.values()).filter(
      (quiz) => quiz.isPublic === true
    );
  }
  
  async createQuiz(quiz: InsertQuiz): Promise<Quiz> {
    const id = this.quizCurrentId++;
    
    // Make sure uniqueId is set
    if (!quiz.uniqueId) {
      quiz.uniqueId = uuidv4();
    }
    
    // Make sure version is set
    const version = quiz.version || 1;
    
    // Set password to null if undefined
    const password = quiz.password === undefined ? null : quiz.password;
    
    // Cast to Quiz type to satisfy type constraints
    const newQuiz = {
      ...quiz,
      id,
      createdAt: quiz.createdAt || new Date(),
      version,
      password
    } as Quiz;
    
    this.quizCollection.set(id, newQuiz);
    return newQuiz;
  }
  
  async updateQuiz(id: number, quizUpdate: Partial<InsertQuiz>): Promise<Quiz | undefined> {
    const existingQuiz = this.quizCollection.get(id);
    
    if (!existingQuiz) {
      return undefined;
    }
    
    const updatedQuiz: Quiz = { 
      ...existingQuiz, 
      ...quizUpdate,
      version: existingQuiz.version ? existingQuiz.version + 1 : 1
    };
    
    this.quizCollection.set(id, updatedQuiz);
    return updatedQuiz;
  }
  
  async deleteQuiz(id: number): Promise<boolean> {
    return this.quizCollection.delete(id);
  }
  
  async syncQuizzes(quizzesToSync: InsertQuiz[]): Promise<Quiz[]> {
    const synced: Quiz[] = [];
    
    for (const quizToSync of quizzesToSync) {
      // Check if quiz with this uniqueId already exists
      const existingQuiz = await this.getQuizByUniqueId(quizToSync.uniqueId);
      
      if (existingQuiz) {
        // Update if the incoming version is newer or same (latest changes win)
        if (!existingQuiz.version || !quizToSync.version || quizToSync.version >= existingQuiz.version) {
          const updated = await this.updateQuiz(existingQuiz.id, quizToSync);
          if (updated) {
            synced.push(updated);
          }
        } else {
          // Existing version is newer, don't update
          synced.push(existingQuiz);
        }
      } else {
        // Create new quiz
        const newQuiz = await this.createQuiz(quizToSync);
        synced.push(newQuiz);
      }
    }
    
    return synced;
  }
}

// Database storage implementation using Drizzle ORM
export class DbStorage implements IStorage {
  private db: ReturnType<typeof drizzle>;
  
  constructor() {
    try {
      // Connect to the database using the correct Neon connection format
      const sql = neon(process.env.DATABASE_URL!);
      // Create a drizzle instance with the SQL connection - client should be first arg
      this.db = drizzle({
        driver: sql
      });
    } catch (error) {
      console.error("Database connection error:", error);
      // Create a fallback in-memory database if connection fails
      throw new Error("Database connection failed. Check your DATABASE_URL environment variable.");
    }
  }
  
  // User methods
  async getUser(id: number): Promise<User | undefined> {
    const result = await this.db.select().from(users).where(eq(users.id, id));
    return result[0];
  }
  
  async getUserByUsername(username: string): Promise<User | undefined> {
    const result = await this.db.select().from(users).where(eq(users.username, username));
    return result[0];
  }
  
  async createUser(insertUser: InsertUser): Promise<User> {
    const result = await this.db.insert(users).values(insertUser).returning();
    return result[0];
  }
  
  // Quiz methods
  async getQuiz(id: number): Promise<Quiz | undefined> {
    const result = await this.db.select().from(quizzes).where(eq(quizzes.id, id));
    return result[0];
  }
  
  async getQuizByUniqueId(uniqueId: string): Promise<Quiz | undefined> {
    const result = await this.db.select().from(quizzes).where(eq(quizzes.uniqueId, uniqueId));
    return result[0];
  }
  
  async getAllQuizzes(): Promise<Quiz[]> {
    return await this.db.select().from(quizzes);
  }
  
  async getPublicQuizzes(): Promise<Quiz[]> {
    return await this.db.select().from(quizzes).where(eq(quizzes.isPublic, true));
  }
  
  async createQuiz(quiz: InsertQuiz): Promise<Quiz> {
    // Generate a uniqueId if not provided
    if (!quiz.uniqueId) {
      quiz.uniqueId = uuidv4();
    }
    
    const result = await this.db.insert(quizzes).values(quiz).returning();
    return result[0];
  }
  
  async updateQuiz(id: number, quizUpdate: Partial<InsertQuiz>): Promise<Quiz | undefined> {
    // Increment version for tracking changes
    let currentQuiz = await this.getQuiz(id);
    if (!currentQuiz) {
      return undefined;
    }
    
    const newVersion = currentQuiz.version ? currentQuiz.version + 1 : 1;
    
    const result = await this.db.update(quizzes)
      .set({ ...quizUpdate, version: newVersion })
      .where(eq(quizzes.id, id))
      .returning();
    
    return result[0];
  }
  
  async deleteQuiz(id: number): Promise<boolean> {
    const result = await this.db.delete(quizzes).where(eq(quizzes.id, id)).returning();
    return result.length > 0;
  }
  
  async syncQuizzes(quizzesToSync: InsertQuiz[]): Promise<Quiz[]> {
    const synced: Quiz[] = [];
    
    for (const quizToSync of quizzesToSync) {
      // Check if quiz with this uniqueId already exists
      const existingQuiz = await this.getQuizByUniqueId(quizToSync.uniqueId);
      
      if (existingQuiz) {
        // Update if the incoming version is newer or same (latest changes win)
        if (!existingQuiz.version || !quizToSync.version || quizToSync.version >= existingQuiz.version) {
          const updated = await this.updateQuiz(existingQuiz.id, quizToSync);
          if (updated) {
            synced.push(updated);
          }
        } else {
          // Existing version is newer, don't update
          synced.push(existingQuiz);
        }
      } else {
        // Create new quiz
        const newQuiz = await this.createQuiz(quizToSync);
        synced.push(newQuiz);
      }
    }
    
    return synced;
  }
}

// Use the DB storage in production, MemStorage in development as fallback
export const storage = process.env.DATABASE_URL 
  ? new DbStorage() 
  : new MemStorage();

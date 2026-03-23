export interface IStorage {
  getJobs(): Promise<any[]>;
  getActiveJobs(): Promise<any[]>;
  getJob(id: number): Promise<any>;
  createJob(job: any): Promise<any>;
  updateJob(id: number, job: any): Promise<any>;

  getReceipts(filters?: any): Promise<any[]>;
  getReceipt(id: number): Promise<any>;
  createReceipt(receipt: any): Promise<any>;
}

class InMemoryStorage implements IStorage {
  jobs: any[] = [
    { id: 1, jobName: "Demo Job 1", status: "Active" },
    { id: 2, jobName: "Demo Job 2", status: "Active" },
  ];

  receipts: any[] = [];

  async getJobs() {
    return this.jobs;
  }

  async getActiveJobs() {
    return this.jobs.filter(j => j.status === "Active");
  }

  async getJob(id: number) {
    return this.jobs.find(j => j.id === id);
  }

  async createJob(job: any) {
    const newJob = { id: Date.now(), ...job };
    this.jobs.push(newJob);
    return newJob;
  }

  async updateJob(id: number, job: any) {
    const index = this.jobs.findIndex(j => j.id === id);
    if (index === -1) return undefined;
    this.jobs[index] = { ...this.jobs[index], ...job };
    return this.jobs[index];
  }

  async getReceipts() {
    return this.receipts;
  }

  async getReceipt(id: number) {
    return this.receipts.find(r => r.id === id);
  }

  async createReceipt(receipt: any) {
    const newReceipt = { id: Date.now(), ...receipt };
    this.receipts.push(newReceipt);
    return newReceipt;
  }
}

export const storage = new InMemoryStorage();

export function seedDatabase() {
  console.log("Using in-memory storage (no DB)");
}

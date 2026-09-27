import { sql } from '@neondatabase/serverless';

export default async function handler(req, res) {
  try {
    // GET: Fetch all projects
    if (req.method === 'GET') {
      const projects = await sql`SELECT * FROM projects ORDER BY id DESC;`;
      return res.status(200).json(projects);
    }

    // POST: Create a new project
    if (req.method === 'POST') {
      const { name, stage } = req.body;
      const result = await sql`
        INSERT INTO projects (name, stage) 
        VALUES (${name}, ${stage}) 
        RETURNING *;
      `;
      return res.status(201).json(result[0]);
    }

    // PUT: Update/Edit an existing project
    if (req.method === 'PUT') {
      const { id, name, stage } = req.body;
      
      if (!id || !name) {
        return res.status(400).json({ error: 'Project ID and name are required' });
      }

      const result = await sql`
        UPDATE projects 
        SET name = ${name}, stage = ${stage} 
        WHERE id = ${id} 
        RETURNING *;
      `;

      if (result.length === 0) {
        return res.status(404).json({ error: 'Project not found' });
      }

      return res.status(200).json(result[0]);
    }

    // DELETE: Remove a project by ID
    if (req.method === 'DELETE') {
      const { id } = req.query;

      if (!id) {
        return res.status(400).json({ error: 'Project ID is required' });
      }

      const result = await sql`
        DELETE FROM projects 
        WHERE id = ${id} 
        RETURNING id;
      `;

      if (result.length === 0) {
        return res.status(404).json({ error: 'Project not found' });
      }

      return res.status(200).json({ message: 'Project deleted successfully', id });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Database error:', error);
    return res.status(500).json({ error: error.message });
  }
}
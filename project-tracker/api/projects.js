import { sql } from '@neondatabase/serverless';

export default async function handler(req, res) {
  try {
    // GET: Fetch all projects
    if (req.method === 'GET') {
      const projects = await sql`
        SELECT 
          id,
          project_id AS "projectId",
          project_name AS "projectName",
          start_date AS "startDate"
        FROM projects 
        ORDER BY id DESC;
      `;
      return res.status(200).json(projects);
    }

    // POST: Create a new project
    if (req.method === 'POST') {
      const { projectName, startDateStr, presetId } = req.body;
      const projectId = 'PRJ-' + Math.floor(1000 + Math.random() * 9000);

      const result = await sql`
        INSERT INTO projects (project_id, project_name, start_date) 
        VALUES (${projectId}, ${projectName}, ${startDateStr}) 
        RETURNING project_id AS "projectId", project_name AS "projectName", start_date AS "startDate";
      `;

      // Copy stages from preset if provided
      if (presetId) {
        const presets = await sql`SELECT * FROM presets WHERE preset_id = ${presetId};`;
        if (presets.length > 0) {
          const stages = presets[0].stages || [];
          for (const s of stages) {
            const startDate = new Date(startDateStr);
            startDate.setDate(startDate.getDate() + parseInt(s.daysOffset || 0, 10));
            const dueDateStr = startDate.toISOString().split('T')[0];

            await sql`
              INSERT INTO stages (project_id, stage_name, stage_order, calculated_due_date, is_completed, remarks)
              VALUES (${projectId}, ${s.stageName}, ${s.stageOrder}, ${dueDateStr}, false, '');
            `;
          }
        }
      }

      return res.status(201).json(result[0]);
    }

    // PUT: Update project name or start date
    if (req.method === 'PUT') {
      const { projectId, projectName, newStartDateStr } = req.body;

      if (!projectId) {
        return res.status(400).json({ error: 'projectId is required' });
      }

      if (projectName) {
        await sql`
          UPDATE projects 
          SET project_name = ${projectName} 
          WHERE project_id = ${projectId};
        `;
      }

      if (newStartDateStr) {
        await sql`
          UPDATE projects 
          SET start_date = ${newStartDateStr} 
          WHERE project_id = ${projectId};
        `;
      }

      return res.status(200).json({ message: 'Project updated successfully' });
    }

    // DELETE: Remove project and its stages
    if (req.method === 'DELETE') {
      const { projectId } = req.query;

      if (!projectId) {
        return res.status(400).json({ error: 'projectId is required' });
      }

      // Delete associated stages first, then the project
      await sql`DELETE FROM stages WHERE project_id = ${projectId};`;
      await sql`DELETE FROM projects WHERE project_id = ${projectId};`;

      return res.status(200).json({ message: 'Project deleted successfully' });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Projects API Error:', error);
    return res.status(500).json({ error: error.message });
  }
}
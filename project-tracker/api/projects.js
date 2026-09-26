import { sql } from '@neondatabase/serverless';

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const projects = await sql`SELECT * FROM projects ORDER BY created_at DESC`;
      return res.status(200).json(projects.map(p => ({
        projectId: p.project_id,
        projectName: p.project_name,
        startDate: p.start_date.toISOString().split('T')[0],
        presetId: p.preset_id,
        status: p.status
      })));
    }

    if (req.method === 'POST') {
      const { projectName, startDateStr, presetId } = req.body;
      const projectId = `PRJ_${Math.random().toString(36).substring(2, 10)}`;

      await sql`
        INSERT INTO projects (project_id, project_name, start_date, preset_id, status)
        VALUES (${projectId}, ${projectName}, ${startDateStr}, ${presetId}, 'Active')
      `;

      // Copy preset stages into project stages
      const presetStages = await sql`SELECT * FROM preset_stages WHERE preset_id = ${presetId} ORDER BY stage_order ASC`;
      const baseDate = new Date(startDateStr);

      for (const stg of presetStages) {
        const calcDueDate = new Date(baseDate);
        calcDueDate.setDate(calcDueDate.getDate() + stg.days_offset);
        const dueDateStr = calcDueDate.toISOString().split('T')[0];

        await sql`
          INSERT INTO project_stages (project_id, stage_name, stage_order, calculated_due_date, is_completed, remarks)
          VALUES (${projectId}, ${stg.stage_name}, ${stg.stage_order}, ${dueDateStr}, FALSE, '')
        `;
      }

      return res.status(200).json({ success: true, projectId });
    }
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
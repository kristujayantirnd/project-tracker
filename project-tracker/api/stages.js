import { neon } from '@neondatabase/serverless';

export default async function handler(req, res) {
  try {
    const sql = neon(process.env.POSTGRES_URL || process.env.DATABASE_URL);
    const { projectId, feed } = req.query;

    if (feed === 'true') {
      const todayStr = new Date().toISOString().split('T')[0];
      const allStages = await sql`
        SELECT ps.*, p.project_name 
        FROM project_stages ps
        JOIN projects p ON ps.project_id = p.project_id
        WHERE ps.is_completed = FALSE
        ORDER BY ps.calculated_due_date ASC
      `;

      const overdue = [];
      const dueToday = [];
      const upcoming = [];

      allStages.forEach(s => {
        const dateStr = new Date(s.calculated_due_date).toISOString().split('T')[0];
        const item = {
          id: s.id,
          projectId: s.project_id,
          projectName: s.project_name,
          stageName: s.stage_name,
          stageOrder: s.stage_order,
          calculatedDueDate: dateStr,
          remarks: s.remarks
        };

        if (dateStr < todayStr) overdue.push(item);
        else if (dateStr === todayStr) dueToday.push(item);
        else upcoming.push(item);
      });

      return res.status(200).json({ overdue, dueToday, upcoming });
    }

    if (req.method === 'GET') {
      const stages = await sql`
        SELECT * FROM project_stages 
        WHERE project_id = ${projectId} 
        ORDER BY stage_order ASC
      `;

      return res.status(200).json(stages.map(s => ({
        id: s.id,
        projectId: s.project_id,
        stageName: s.stage_name,
        stageOrder: s.stage_order,
        calculatedDueDate: new Date(s.calculated_due_date).toISOString().split('T')[0],
        isCompleted: s.is_completed,
        remarks: s.remarks
      })));
    }

    if (req.method === 'PUT') {
      let body = req.body;
      if (typeof body === 'string') {
        try { body = JSON.parse(body); } catch(e) {}
      }

      const { id, isCompleted, remarks, calculatedDueDate } = body || {};

      if (calculatedDueDate !== undefined) {
        await sql`UPDATE project_stages SET calculated_due_date = ${calculatedDueDate} WHERE id = ${id}`;
      } else {
        await sql`UPDATE project_stages SET is_completed = ${isCompleted}, remarks = ${remarks} WHERE id = ${id}`;
      }
      return res.status(200).json({ success: true });
    }

    if (req.method === 'POST') {
      let body = req.body;
      if (typeof body === 'string') {
        try { body = JSON.parse(body); } catch(e) {}
      }

      const { projectId, stageName, dueDateStr } = body || {};
      const countRes = await sql`SELECT COUNT(*) FROM project_stages WHERE project_id = ${projectId}`;
      const nextOrder = parseInt(countRes[0].count, 10) + 1;

      await sql`
        INSERT INTO project_stages (project_id, stage_name, stage_order, calculated_due_date)
        VALUES (${projectId}, ${stageName}, ${nextOrder}, ${dueDateStr})
      `;
      return res.status(200).json({ success: true });
    }

    if (req.method === 'DELETE') {
      let body = req.body;
      if (typeof body === 'string') {
        try { body = JSON.parse(body); } catch(e) {}
      }

      const { id } = body || {};
      await sql`DELETE FROM project_stages WHERE id = ${id}`;
      return res.status(200).json({ success: true });
    }
  } catch (error) {
    console.error('Stages API Error:', error);
    return res.status(500).json({ error: error.message });
  }
}

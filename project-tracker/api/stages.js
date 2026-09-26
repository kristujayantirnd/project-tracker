import { sql } from '@neondatabase/serverless';

export default async function handler(req, res) {
  try {
    const { projectId } = req.query;

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
        calculatedDueDate: s.calculated_due_date.toISOString().split('T')[0],
        isCompleted: s.is_completed,
        remarks: s.remarks
      })));
    }

    if (req.method === 'PUT') {
      const { id, isCompleted, remarks, calculatedDueDate } = req.body;
      
      if (calculatedDueDate !== undefined) {
        await sql`UPDATE project_stages SET calculated_due_date = ${calculatedDueDate} WHERE id = ${id}`;
      } else {
        await sql`UPDATE project_stages SET is_completed = ${isCompleted}, remarks = ${remarks} WHERE id = ${id}`;
      }
      return res.status(200).json({ success: true });
    }

    if (req.method === 'POST') {
      const { projectId, stageName, dueDateStr } = req.body;
      const countRes = await sql`SELECT COUNT(*) FROM project_stages WHERE project_id = ${projectId}`;
      const nextOrder = parseInt(countRes[0].count, 10) + 1;

      await sql`
        INSERT INTO project_stages (project_id, stage_name, stage_order, calculated_due_date)
        VALUES (${projectId}, ${stageName}, ${nextOrder}, ${dueDateStr})
      `;
      return res.status(200).json({ success: true });
    }

    if (req.method === 'DELETE') {
      const { id } = req.body;
      await sql`DELETE FROM project_stages WHERE id = ${id}`;
      return res.status(200).json({ success: true });
    }
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
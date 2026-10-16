const fs = require('fs');
const path = require('path');
const PizZip = require('pizzip');
const Docxtemplater = require('docxtemplater');
const { getTemplate } = require('./documentTemplates');

const TEMPLATES_DIR = path.join(__dirname, '..', 'templates');

// Fills a template's {field} placeholders and returns the rendered .docx
// buffer, plus a filesystem-safe filename to download it as.
function renderDocx(templateId, data) {
  const template = getTemplate(templateId);
  if (!template) {
    const err = new Error('القالب غير موجود');
    err.status = 404;
    throw err;
  }

  const filePath = path.join(TEMPLATES_DIR, template.file);
  const content = fs.readFileSync(filePath, 'binary');
  const zip = new PizZip(content);
  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
    nullGetter: () => '',
  });

  const values = {};
  for (const field of template.fields) {
    values[field.name] = data[field.name] != null ? String(data[field.name]) : '';
  }

  doc.render(values);
  const buffer = doc.getZip().generate({ type: 'nodebuffer' });
  return { buffer, filename: `${template.file.replace(/\.docx$/, '')}.docx` };
}

module.exports = { renderDocx };

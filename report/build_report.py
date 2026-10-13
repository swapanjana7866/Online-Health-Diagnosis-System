from __future__ import annotations

import json
import os
import re
import sys
import textwrap
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = Path(__file__).resolve().parent
sys.path.insert(0, str(OUT / 'vendor'))
os.environ['MPLCONFIGDIR'] = str(OUT / '.mplconfig')
Path(os.environ['MPLCONFIGDIR']).mkdir(exist_ok=True)

import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.patches import FancyBboxPatch, Ellipse, Polygon

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    BaseDocTemplate, PageTemplate, Frame, Paragraph, Spacer, PageBreak,
    Table, TableStyle, Image, Flowable, KeepTogether, NextPageTemplate
)
from reportlab.platypus.tableofcontents import TableOfContents
from reportlab.pdfgen.canvas import Canvas
from xml.sax.saxutils import escape

PDF_PATH = OUT / 'Online_Health_Diagnosis_System_Report.pdf'
FIG_DIR = OUT / 'figures'
FIG_DIR.mkdir(exist_ok=True)

FONT_DIR = Path('C:/Windows/Fonts')
pdfmetrics.registerFont(TTFont('Arial', str(FONT_DIR / 'arial.ttf')))
pdfmetrics.registerFont(TTFont('Arial-Bold', str(FONT_DIR / 'arialbd.ttf')))
pdfmetrics.registerFont(TTFont('Consolas', str(FONT_DIR / 'consola.ttf')))

NAVY = colors.HexColor('#15324B')
TEAL = colors.HexColor('#137C8B')
PALE = colors.HexColor('#EEF4F7')
INK = colors.HexColor('#243746')
MUTED = colors.HexColor('#5E7180')
LINE = colors.HexColor('#CFD9E0')

styles = getSampleStyleSheet()
styles.add(ParagraphStyle(name='BodyX', fontName='Arial', fontSize=9.1, leading=13.1, textColor=INK, spaceAfter=6))
styles.add(ParagraphStyle(name='SmallX', fontName='Arial', fontSize=7.8, leading=10.6, textColor=INK, spaceAfter=4))
styles.add(ParagraphStyle(name='TitleX', fontName='Arial-Bold', fontSize=24, leading=29, textColor=NAVY, alignment=TA_CENTER, spaceAfter=12))
styles.add(ParagraphStyle(name='SubTitleX', fontName='Arial', fontSize=13, leading=18, textColor=TEAL, alignment=TA_CENTER, spaceAfter=10))
styles.add(ParagraphStyle(name='H1X', fontName='Arial-Bold', fontSize=16, leading=20, textColor=NAVY, spaceBefore=5, spaceAfter=9, keepWithNext=True))
styles.add(ParagraphStyle(name='H2X', fontName='Arial-Bold', fontSize=11.5, leading=15, textColor=TEAL, spaceBefore=7, spaceAfter=5, keepWithNext=True))
styles.add(ParagraphStyle(name='H3X', fontName='Arial-Bold', fontSize=9.5, leading=12, textColor=NAVY, spaceBefore=6, spaceAfter=3, keepWithNext=True))
styles.add(ParagraphStyle(name='CaptionX', fontName='Arial', fontSize=8, leading=10, textColor=MUTED, alignment=TA_CENTER, spaceBefore=4, spaceAfter=9))
styles.add(ParagraphStyle(name='CellX', fontName='Arial', fontSize=7.5, leading=9.3, textColor=INK))
styles.add(ParagraphStyle(name='CellHeadX', fontName='Arial-Bold', fontSize=7.5, leading=9.3, textColor=colors.white))
styles.add(ParagraphStyle(name='TOCX', fontName='Arial', fontSize=9, leading=13, leftIndent=16, firstLineIndent=-13, textColor=INK))


def p(text, style='BodyX'):
    return Paragraph(text, styles[style])


def bullet(text):
    return p('&#8226;&nbsp; ' + text)


def safe_text(value):
    return escape(str(value)).replace('\n', '<br/>')


class CodeBlock(Flowable):
    """Paginated shaded source block with preserved line breaks and indentation."""
    def __init__(self, source, font_size=5.4, leading=7.0, pad=5):
        super().__init__()
        self.source_lines = source.splitlines() or ['']
        self.font_size = font_size
        self.leading = leading
        self.pad = pad
        self.lines = []
        self.width = 0
        self.height = 0

    def wrap(self, avail_width, avail_height):
        self.width = avail_width
        max_chars = max(24, int((avail_width - 2 * self.pad) / (self.font_size * 0.61)))
        self.lines = []
        for source_line in self.source_lines:
            if not source_line:
                self.lines.append('')
                continue
            wrapped = textwrap.wrap(source_line, width=max_chars, subsequent_indent='    ',
                                    replace_whitespace=False, drop_whitespace=False,
                                    break_long_words=True, break_on_hyphens=False)
            self.lines.extend(wrapped or [''])
        self.height = len(self.lines) * self.leading + 2 * self.pad
        return self.width, self.height

    def split(self, avail_width, avail_height):
        room = int((avail_height - 2 * self.pad) // self.leading)
        if room < 2 or room >= len(self.lines):
            return []
        left = CodeBlock('', self.font_size, self.leading, self.pad)
        right = CodeBlock('', self.font_size, self.leading, self.pad)
        left.lines = self.lines[:room]
        right.lines = self.lines[room:]
        left.source_lines = left.lines
        right.source_lines = right.lines
        left.width = right.width = avail_width
        left.height = len(left.lines) * self.leading + 2 * self.pad
        right.height = len(right.lines) * self.leading + 2 * self.pad
        return [left, right]

    def draw(self):
        c = self.canv
        c.setFillColor(PALE)
        c.setStrokeColor(LINE)
        c.roundRect(0, 0, self.width, self.height, 3, fill=1, stroke=1)
        c.setFillColor(INK)
        c.setFont('Consolas', self.font_size)
        y = self.height - self.pad - self.leading + 1.5
        for line in self.lines:
            c.drawString(self.pad, y, line)
            y -= self.leading


class ReportDoc(BaseDocTemplate):
    def __init__(self, filename):
        super().__init__(str(filename), pagesize=A4, title='Online Health Diagnosis System Project Report',
                         author='[Student Full Name]', subject='BCA Project Report')
        frame = Frame(18*mm, 17*mm, A4[0]-36*mm, A4[1]-34*mm, id='normal', leftPadding=0,
                      rightPadding=0, topPadding=0, bottomPadding=0)
        self.addPageTemplates([PageTemplate(id='main', frames=frame, onPage=self.draw_page)])

    def draw_page(self, canvas, doc):
        if doc.page == 1:
            return
        canvas.saveState()
        canvas.setStrokeColor(LINE)
        canvas.setLineWidth(0.5)
        canvas.line(18*mm, 13*mm, A4[0]-18*mm, 13*mm)
        canvas.setFont('Arial', 7.5)
        canvas.setFillColor(MUTED)
        canvas.drawString(18*mm, 8.5*mm, 'Online Health Diagnosis System | BCA Project Report')
        canvas.drawRightString(A4[0]-18*mm, 8.5*mm, f'Page {doc.page}')
        canvas.restoreState()

    def afterFlowable(self, flowable):
        if isinstance(flowable, Paragraph) and getattr(flowable, '_toc_level', None) is not None:
            text = flowable.getPlainText()
            key = f'h{self.seq.nextf("heading")}'
            self.canv.bookmarkPage(key)
            self.canv.addOutlineEntry(text, key, flowable._toc_level, False)
            self.notify('TOCEntry', (flowable._toc_level, text, self.page, key))


def heading(text, level=0):
    style = 'H1X' if level == 0 else ('H2X' if level == 1 else 'H3X')
    item = p(text, style)
    item._toc_level = level
    return item


def code_file(story, rel_path, explanation=None, font_size=5.25):
    path = ROOT / rel_path
    if not path.exists():
        story.append(p(f'<b>Source file unavailable:</b> {safe_text(rel_path)}', 'SmallX'))
        return
    story.append(heading(safe_text(rel_path), 2))
    if explanation:
        story.append(p(escape(explanation), 'SmallX'))
    source = path.read_text(encoding='utf-8', errors='replace')
    # Exclude accidental secret material even if a future allowlisted file changes.
    source = re.sub(r"(?i)(\b(?:GEMINI_API_KEY|JWT_SECRET|MONGODB_URI|DATABASE_URL|API_KEY|APIKEY|ACCESS_TOKEN|REFRESH_TOKEN)\b\s*[:=]\s*)(['\"])[^'\"]*\2", r"\1'[REDACTED]'", source)
    source = re.sub(r"(?i)(\bpassword\b\s*:\s*)(['\"])[^'\"]*\2", r"\1'[REDACTED]'", source)
    source = re.sub(r"(?i)(\btoken\b\s*:\s*)(['\"])(?:eyJ[^'\"]*|[^'\"]{16,})\2", r"\1'[REDACTED]'", source)
    story.append(CodeBlock(source, font_size=font_size))
    story.append(Spacer(1, 5))


def make_figure(name, title, nodes, edges, direction='LR', note=None, shapes=None):
    fig, ax = plt.subplots(figsize=(11.4, 4.2 if len(nodes) < 7 else 5.2), dpi=170)
    fig.patch.set_facecolor('white')
    ax.set_facecolor('white')
    ax.axis('off')
    n = len(nodes)
    if direction == 'TB':
        positions = {i: (0.5, 0.91 - i * (0.82 / max(n-1, 1))) for i in range(n)}
    elif n > 7:
        layout = [(0.08,0.55),(0.30,0.82),(0.30,0.31),
                  (0.53,0.55),(0.77,0.28),(0.53,0.87),
                  (0.78,0.78),(0.54,0.15),(0.91,0.53)]
        positions = {i: layout[i] for i in range(n)}
    else:
        positions = {i: (0.06 + i * (0.88 / max(n-1, 1)), 0.54 + (0.11 if i % 2 == 0 else -0.11)) for i in range(n)}
    if shapes:
        positions.update(shapes)
    for i, label in enumerate(nodes):
        x, y = positions[i]
        kind = (shapes or {}).get(('kind', i), 'process') if shapes else 'process'
        if kind == 'entity':
            patch = FancyBboxPatch((x-0.075, y-0.075), 0.15, 0.15, boxstyle='square,pad=0.015',
                                   linewidth=1.4, edgecolor='#15324B', facecolor='#F2F7FA')
        elif kind == 'store':
            patch = plt.Rectangle((x-0.082, y-0.065), 0.164, 0.13, linewidth=1.4,
                                  edgecolor='#137C8B', facecolor='#E8F4F4')
        elif kind == 'actor':
            patch = Ellipse((x, y), 0.15, 0.12, linewidth=1.4, edgecolor='#15324B', facecolor='#F2F7FA')
        else:
            patch = FancyBboxPatch((x-0.085, y-0.07), 0.17, 0.14, boxstyle='round,pad=0.015,rounding_size=0.025',
                                   linewidth=1.4, edgecolor='#15324B', facecolor='#EAF3F8')
        ax.add_patch(patch)
        ax.text(x, y, label, ha='center', va='center', fontsize=7.5, color='#15324B', wrap=True)
    for edge in edges:
        a, b, label = edge[:3]
        x1, y1 = positions[a]
        x2, y2 = positions[b]
        rad = edge[3] if len(edge) > 3 else 0
        ax.annotate('', xy=(x2, y2), xytext=(x1, y1),
                    arrowprops=dict(arrowstyle='-|>', color='#137C8B', lw=1.25,
                                    connectionstyle=f'arc3,rad={rad}', shrinkA=22, shrinkB=22))
        lx, ly = (x1+x2)/2, (y1+y2)/2
        if rad:
            offset = 0.24 if rad > 0 else -0.24
            lx += -(y2-y1) * offset
            ly += (x2-x1) * offset
        else:
            ly += 0.045
        ax.text(lx, ly, label, ha='center', va='center', fontsize=6.4, color='#405B6D',
                bbox=dict(boxstyle='round,pad=0.15', fc='white', ec='none', alpha=0.9))
    ax.set_xlim(-0.04, 1.04)
    ax.set_ylim(0.08, 1.02)
    ax.set_title(title, fontsize=13, color='#15324B', pad=12, fontweight='bold')
    if note:
        fig.text(0.5, 0.015, note, ha='center', fontsize=7, color='#5E7180')
    path = FIG_DIR / f'{name}.png'
    fig.savefig(path, bbox_inches='tight', facecolor='white')
    plt.close(fig)
    return path


def make_workflow():
    fig, ax = plt.subplots(figsize=(9, 5.4), dpi=170)
    fig.patch.set_facecolor('white')
    ax.axis('off')
    labels = ['Requirements\n& planning', 'System\nanalysis', 'Design', 'Implementation\n(iteration)', 'Testing &\nverification', 'Deployment &\nmaintenance']
    coords = [(0.22,0.84),(0.68,0.84),(0.22,0.59),(0.68,0.59),(0.22,0.34),(0.68,0.34)]
    for text, (x,y) in zip(labels, coords):
        box = FancyBboxPatch((x-0.14,y-0.055),0.28,0.11,boxstyle='round,pad=0.012,rounding_size=0.02',
                             fc='#EAF3F8',ec='#15324B',lw=1.4)
        ax.add_patch(box); ax.text(x,y,text,ha='center',va='center',fontsize=8,color='#15324B')
    links=[((.36,.84),(.54,.84)),((.68,.78),(.36,.65)),((.36,.59),(.54,.59)),((.68,.53),(.36,.40)),((.36,.34),(.54,.34))]
    for a,b in links: ax.annotate('',xy=b,xytext=a,arrowprops=dict(arrowstyle='-|>',lw=1.4,color='#137C8B'))
    ax.annotate('Feedback from tests / review',xy=(.24,.79),xytext=(.04,.26),
                arrowprops=dict(arrowstyle='-|>',connectionstyle='arc3,rad=-0.48',lw=1.2,color='#D07A32'),
                fontsize=7,color='#9B571E',ha='center')
    ax.set_xlim(-0.02,1.02); ax.set_ylim(.18,1.0)
    ax.set_title('Iterative Waterfall Development Workflow',fontsize=13,color='#15324B',fontweight='bold')
    path=FIG_DIR/'iterative_waterfall.png'; fig.savefig(path,bbox_inches='tight',facecolor='white'); plt.close(fig); return path


def image_figure(path, width=165*mm):
    img = Image(str(path), width=width, height=width * 0.40)
    img.hAlign = 'CENTER'
    return img


def table(data, widths=None, repeatRows=1, font=7.4):
    converted=[]
    for ri,row in enumerate(data):
        converted.append([Paragraph(str(cell), styles['CellHeadX' if ri == 0 else 'CellX']) for cell in row])
    t=Table(converted, colWidths=widths, repeatRows=repeatRows, hAlign='LEFT')
    t.setStyle(TableStyle([
        ('BACKGROUND',(0,0),(-1,0),NAVY),('GRID',(0,0),(-1,-1),0.35,LINE),
        ('VALIGN',(0,0),(-1,-1),'TOP'),('LEFTPADDING',(0,0),(-1,-1),5),
        ('RIGHTPADDING',(0,0),(-1,-1),5),('TOPPADDING',(0,0),(-1,-1),4),
        ('BOTTOMPADDING',(0,0),(-1,-1),4),('ROWBACKGROUNDS',(0,1),(-1,-1),[colors.white,PALE])
    ]))
    return t


def add_labelled_figure(story, path, caption):
    story.append(image_figure(path))
    story.append(p(escape(caption), 'CaptionX'))


def build_figures():
    figures={}
    figures['workflow']=make_workflow()
    figures['architecture']=make_figure('system_architecture','MedInsight System Architecture',
        ['Patient / Browser','React + Vite\nProtected pages','Express API\nRoutes + controllers','MongoDB\nMongoose','Gemini API','Python ML API\nClassifier'],
        [(0,1,'interaction'),(1,2,'HTTPS / JSON'),(2,3,'read / write'),(2,4,'prompt / response'),(2,5,'HTTP /predict')],
        note='Gemini and Python inference are server-side integrations; the browser communicates through the API gateway.')
    figures['dfd0']=make_figure('dfd_level_0','Data Flow Diagram — Level 0 (Context)',
        ['Patient','Online Health\nDiagnosis System','Doctor / Clinic','Gemini / ML\nProviders','MongoDB'],
        [(0,1,'symptoms, login, booking'),(1,0,'triage, history, status'),(1,2,'consultation details'),(1,3,'symptom payload'),(3,1,'guidance / scores'),(1,4,'records'),(4,1,'user, diagnosis, appointment data')],
        note='External entities and high-level data entering or leaving the system.')
    figures['dfd1']=make_figure('dfd_level_1','Data Flow Diagram — Level 1 (Core Processes)',
        ['Patient / UI','1.0 Account &\nprofile','2.0 Symptom\nintake','3.0 Triage &\nprediction','4.0 Doctor &\nbooking','D1 Users','D2 Diagnoses','D3 Doctors /\nAppointments','Gemini / ML'],
        [(0,1,'credentials'),(1,5,'user record'),(0,2,'symptoms'),(2,3,'normalized symptoms'),(3,8,'inference request',0.25),(8,3,'assessment',0.25),(3,6,'save result'),(6,0,'report/history'),(0,4,'booking request',-0.12),(4,7,'appointment'),(7,4,'slots / status')])
    figures['sequence']=make_figure('symptom_prediction_sequence','Sequence Diagram — Symptom to Prediction',
        ['Patient','React UI','Express route\n+ validator','Controller /\npredictionService','Gemini or ML\n+ fallback','MongoDB'],
        [(0,1,'enter symptoms'),(1,2,'POST /api/diagnoses/predict'),(2,3,'validated request'),(3,4,'candidate assessment'),(4,3,'structured result'),(3,5,'persist if signed in'),(5,3,'record id'),(3,1,'result + disclaimer'),(1,0,'display report')])
    figures['usecase']=make_figure('use_case','Use Case Diagram — Main Actors and Functions',
        ['Guest / Patient','Create account /\nSign in','Submit symptoms\n& view triage','Chat about\nsymptoms','Browse doctors\n& book','View profile\n& history','Doctor / Clinic'],
        [(0,1,'identity'),(0,2,'assessment'),(0,3,'conversation'),(0,4,'consultation'),(0,5,'records'),(6,4,'appointment service')])
    figures['er']=make_figure('schema_er','ER-Style Schema — Mongoose Models',
        ['User\naccounts','Diagnosis\ntriage records','Doctor\nprofiles','Appointment\nbookings'],
        [(0,1,'one-to-many: user'),(0,3,'one-to-many: user'),(2,3,'one-to-many: doctor')],
        note='Diagnosis and Appointment reference User by ObjectId; Appointment also references Doctor. Doctor records are independent profiles.')
    return figures


def add_source_section(story, section_title, files):
    story.append(heading(section_title, 0))
    for rel, explain in files:
        code_file(story, rel, explain)


def add_certificates(story):
    certs=[
        ('Self Certificate','I, [Student Full Name], certify that this project report titled “Online Health Diagnosis System” is my original work completed as part of the Bachelor of Computer Applications programme. Sources and external tools used are acknowledged in the bibliography. The system provides preliminary educational triage only and is not a medical diagnosis.'),
        ('Certificate by Guide','This is to certify that [Student Full Name] completed the project report and implementation work entitled “Online Health Diagnosis System” under my guidance at [Company Name]. The work is submitted for academic review to [College/University Name].'),
        ('Certificate of Approval','This project report has been examined and approved as partial fulfilment of the Bachelor of Computer Applications requirements of [College/University Name]. Approval is subject to the institution’s evaluation and academic rules.')
    ]
    for title, body in certs:
        story.append(heading(title,1)); story.append(Spacer(1,8)); story.append(p(body))
        story.append(Spacer(1,12))
        story.append(p('Student: [Student Full Name] &nbsp;&nbsp;&nbsp;&nbsp; Guide: [Mentor Name]'))
        story.append(Spacer(1,18))
        story.append(p('Student Signature: ____________________________________'))
        story.append(p('Guide Signature: ______________________________________'))
        story.append(p('Company / Department Seal: ______________________________'))
        story.append(p('Date: ____________________ &nbsp;&nbsp;&nbsp; Place: ____________________'))
        story.append(Spacer(1,12))


def add_schema(story):
    story.append(heading('7. Schema Design',0))
    story.append(p('The following summary is derived from the four Mongoose models. ObjectId references describe application relationships; timestamps are added by Mongoose where enabled. Nested diagnosis insight and top-candidate schemas are summarized separately.'))
    rows=[['Model','Field','Mongoose type / rule','Relationship / purpose']]
    schema_rows=[
        ('User','name','String; required, 2–50 chars','Account identity'),('User','email','String; unique, lowercase, validated','Login identifier'),('User','password','String; required, min 8, select:false','Stored credential hash'),('User','age, gender','Number; String enum','Optional profile details'),('User','dateOfBirth, bloodType','Date; String','Optional health profile'),('User','allergies','[String]','Optional profile list'),
        ('Doctor','name, specialty','String; required','Provider display and classification'),('Doctor','email','String; unique, lowercase','Provider contact identifier'),('Doctor','available','Boolean; default true','Availability state'),('Doctor','rating','Number 0–5; default 5','Display rating'),('Doctor','consultationFee','Number ≥0; default constant','Displayed consultation fee'),('Doctor','availabilitySlots','[String]','Available booking slots'),
        ('Appointment','user','ObjectId ref User; required, indexed','Many appointments belong to one user'),('Appointment','doctor','ObjectId ref Doctor; required, indexed','Many appointments reference a doctor'),('Appointment','doctorName, specialty','String; required','Snapshot fields for the booked provider'),('Appointment','appointmentDate','Date; required','Scheduled date'),('Appointment','timeSlot','String; required','Scheduled slot'),('Appointment','reason','String; max 300','Patient’s booking reason'),('Appointment','status','String enum; pending/confirmed/completed/cancelled','Booking lifecycle'),
        ('Diagnosis','user','ObjectId ref User; required, indexed','Many diagnoses belong to one user'),('Diagnosis','symptoms','[String]','Submitted symptom identifiers'),('Diagnosis','predictedDisease','String; required','Primary preliminary condition'),('Diagnosis','confidence','Number 0–100','Displayed score with confidenceBasis'),('Diagnosis','confidenceBasis','Enum: model_probability, gemini_estimate, heuristic_overlap, rule_based, none','Meaning of score'),('Diagnosis','severity','Enum: mild/moderate/severe','Triage urgency category'),('Diagnosis','topPredictions','[subdocument]','Ranked candidate conditions'),('Diagnosis','description, recommendation','String','Explanation and next-step guidance'),('Diagnosis','duration, notes','String','User-provided assessment context'),('Diagnosis','disclaimer','String','Mandatory clinical disclaimer'),('Diagnosis','geminiInsights','Nested subdocument','Explanation, warning signs, care and metadata'),('Diagnosis','predictionProvider, isFallback, status','String enum; Boolean; String enum','Provenance and lifecycle')]
    for model,field,typ,rel in schema_rows: rows.append([model,field,typ,rel])
    story.append(table(rows,[27*mm,39*mm,62*mm,52*mm]))
    story.append(Spacer(1,8)); story.append(heading('Indexes and relationships',1))
    story.append(bullet('Appointment has a compound index on user and appointmentDate descending.'))
    story.append(bullet('Diagnosis has a compound index on user and createdAt descending; it also exposes userId and possibleConditions virtuals.'))
    story.append(bullet('User email and Doctor email are unique. Appointment references both User and Doctor; Diagnosis references User.'))


def create_story(figs):
    s=[]
    # Cover page.
    s += [Spacer(1,35*mm),p('ONLINE HEALTH<br/>DIAGNOSIS SYSTEM', 'TitleX'),
          p('BCA PROJECT REPORT', 'SubTitleX'),Spacer(1,8*mm),
          p('A full-stack application for preliminary symptom triage, health guidance, and doctor appointment workflows.', 'BodyX'),
          Spacer(1,15*mm),p('<b>Submitted by</b><br/>[Student Full Name]', 'SubTitleX'),
          p('<b>Under the guidance of</b><br/>[Mentor Name]', 'SubTitleX'),Spacer(1,7*mm),
          p('[College/University Name]', 'SubTitleX'),p('[Company Name] | Academic Year: [Academic Year]', 'CaptionX'),PageBreak()]
    # TOC/index.
    s += [heading('Index / Table of Contents',0),Spacer(1,4),TableOfContents()]
    s[-1].levelStyles=[styles['TOCX'],styles['TOCX'],styles['TOCX']]
    s += [PageBreak(),heading('1. Certificates',0)]
    add_certificates(s)
    s += [heading('2. About the Company',0),p('[Company Name] is an organization focused on software development, digital services, and technology-enabled solutions. Replace this sample paragraph with the approved company profile, location, business domains, and mentoring context before submission.'),
          p('Project context: this report documents an academic implementation. It does not imply clinical certification, a production deployment, or an association with a healthcare provider.')]
    s += [heading('3. Introduction',0),p('Online Health Diagnosis System (also named Carepath / MedInsight in parts of the code and documentation) is a browser-based application for recording symptoms and receiving preliminary, AI-assisted triage guidance. Its interface is implemented in React and Vite. An Express API validates requests and coordinates Mongoose persistence, a symptom-processing engine, Gemini integration, and a Python ML service. The application also includes account, profile, doctor, and appointment features.'),
          p('The project is informational and educational. It does not provide a confirmed diagnosis, does not replace a clinician, and preserves a medical disclaimer in health-related responses.'),
          heading('2A. Objective',1),bullet('Build a responsive full-stack flow for entering symptoms and presenting preliminary assessment information.'),bullet('Separate browser presentation, API orchestration, persistence, and Python classification into maintainable components.'),bullet('Support authentication, diagnosis history, doctor discovery, and appointment booking.'),bullet('Apply input validation, standardized API envelopes, emergency handling, and graceful fallback behavior.'),
          heading('2B. Scope',1),p('Included scope: user registration and sign-in; protected dashboard and profile; symptom assessment; conversational chatbot; diagnosis persistence and history; doctor list and appointment booking; API validation and rate limits; an ML service bridge with local fallback; unit tests for service logic.'),
          p('Limitations: triage output is not a medical diagnosis; live provider behavior depends on deployment configuration; the report does not claim that external services or database connectivity were available during this build. Features are described from checked-in source rather than assumed deployment state.')]
    s += [heading('4. System Analysis',0),heading('3A. Identification of Need',1),p('Users often need an accessible starting point to organize symptoms and decide whether to seek professional help. The project responds with a structured symptom form and conversational intake, paired with explicit uncertainty and emergency guidance. A single API also supports profiles, stored assessment history, provider discovery, and appointment requests.'),
          heading('3B. Feasibility Study',1)]
    feasibility=[['Dimension','Assessment'],['Technical','Feasible with the repository stack: React/Vite, Node/Express, MongoDB/Mongoose, Python/Flask classifier, and optional Gemini API integration. Provider and database credentials are external deployment requirements.'],['Operational','Browser workflows cover assessment, account/profile, chat, doctor lookup, and appointment handling. Medical disclaimers and explicit emergency wording set user expectations.'],['Economic','The application uses open-source runtime libraries and can be run locally; hosting, database, model-serving, and third-party API costs depend on selected providers and usage.'],['Schedule','An iterative waterfall approach fits a student project: define requirements, design modules, implement vertical slices, test, and refine based on test results.'],['Legal / safety','This is preliminary educational triage only. A clinical review, privacy review, and jurisdiction-specific compliance work would be required before real clinical use.']]
    s.append(table(feasibility,[31*mm,149*mm])); s += [Spacer(1,6),heading('3C. Workflow — Iterative Waterfall',1)]
    add_labelled_figure(s,figs['workflow'],'Figure 1. Iterative waterfall with feedback from test and review stages.')
    s += [p('The project follows sequential requirement, analysis, design, implementation, and verification stages, while allowing feedback from tests to revisit earlier decisions. It is not a claim that the repository enforces a formal lifecycle toolchain.')]
    s += [heading('3D. Study of the System: Modules and Pages',1)]
    modules=[['Module / route','Implemented responsibilities'],['Home / dashboard (`/dashboard`)','Landing workspace for an authenticated user; links to assessment, chat, profile, and appointments; displays diagnosis/appointment context.'],['Symptom input and report (`/diagnosis`)','DiagnosisForm collects and submits symptom input, then renders the returned triage/diagnosis result with safety information. The report view is part of this page, not a separately routed screen.'],['Doctor consultations (`/appointments`)','Appointments page loads doctors and availability, selects a provider/date/time, and submits a booking. There is no separate doctor consultation page route.'],['Booking details','Appointment list/status and booking form are handled in the Appointments page; appointment records are linked to User and Doctor.'],['Chatbot (`/chatbot`)','Conversational intake, symptom detection, emergency rules, optional inference, suggestions, and appointment handoff.'],['Sign in (`/login`)','Login form calls auth service, updates AuthContext, and routes to dashboard.'],['Sign up (`/signup`)','Registration form validates basic fields/password and creates an authenticated session.'],['Profile (`/profile`)','Reads and updates profile information through protected user endpoints.']]
    s.append(table(modules,[49*mm,131*mm]))
    s += [heading('3E. Software Requirement Specification',1),heading('Functional Requirements',2)]
    fr=[['ID','Requirement reflected in implementation'],['FR-01','Register and sign in with validated credentials; password values are not selected by default in User queries.'],['FR-02','Protect user, diagnosis, and appointment routes with JWT authentication; chat supports optional authentication.'],['FR-03','Submit symptoms through a diagnosis endpoint and return an assessment envelope including disclaimer and triage details.'],['FR-04','Persist authenticated diagnoses and retrieve paginated user diagnosis history.'],['FR-05','Retrieve and update user profile fields.'],['FR-06','List doctors and create/list appointments with date, slot, reason, and status.'],['FR-07','Accept chatbot messages and optional history; classify symptoms, handle emergencies, and optionally run prediction.'],['FR-08','Return consistent success/error response envelope `{ success, message, data, error }`.']]
    s.append(table(fr,[22*mm,158*mm])); s += [heading('Non-Functional Requirements',2)]
    nfr=[['ID','Requirement'],['NFR-01 Security','JWT auth, bcrypt-based credential handling in auth code, Helmet, explicit CORS, input validators, and rate limiting.'],['NFR-02 Safety','Preliminary triage language, preserved medical disclaimer, conservative urgent-care recommendations, no replacement for medical advice.'],['NFR-03 Reliability','Typed Gemini errors, request timeouts, local symptom/clinical fallback, API error middleware, and safe controller handling.'],['NFR-04 Maintainability','Layered routes/controllers/services/models; shared constants; module-separated Python inference service.'],['NFR-05 Performance','Asynchronous API calls, indexed user history queries, and bounded request payloads.'],['NFR-06 Privacy','Gemini prompts are constructed in backend services; keys are server-side environment configuration and excluded from this report.'],['NFR-07 Accessibility','Semantic labels and responsive UI behavior should be reviewed in browser testing; no accessibility audit is claimed here.']]
    s.append(table(nfr,[34*mm,146*mm]))
    s += [heading('5. Software Engineering Paradigm Applied',0),p('The codebase uses a layered, service-oriented full-stack design with an iterative waterfall development approach. React components own page interaction and local state; AuthContext carries shared authentication state; a centralized Axios service calls Express endpoints. Express routers apply middleware and validation before controllers. Controllers orchestrate domain services and Mongoose models. The Python service isolates feature encoding and classifier inference.'),
          bullet('<b>Separation of concerns:</b> routes, middleware, controllers, services, models, and UI pages have distinct responsibilities.'),
          bullet('<b>Service orchestration:</b> predictionService controls provider selection and fallback; mlService bridges to the Python service; geminiService parses and sanitizes provider output.'),
          bullet('<b>Defensive design:</b> request bounds, schema validation, safe response envelopes, typed provider errors, and retry/timeouts are present.'),
          bullet('<b>Testability:</b> Node services accept dependency overrides in key prediction paths; Python endpoint logic is covered by pytest tests.'),
          p('The implementation is a modular monolith on the web/API side with a separately deployable ML microservice. The exact live prediction order follows the current code: default Gemini preliminary prediction for non-empty symptoms, then symptom-engine/ML fallback; Gemini can also enrich engine results. In `ml` mode, local explanations are used.')]
    s += [heading('6. Diagrams',0)]
    add_labelled_figure(s,figs['architecture'],'Figure 2. System architecture based on the checked-in frontend, API, database, Gemini, and Python ML service.')
    add_labelled_figure(s,figs['dfd0'],'Figure 3. DFD Level 0: system context and external data exchange.')
    add_labelled_figure(s,figs['dfd1'],'Figure 4. DFD Level 1: account, triage, prediction, provider, and data-store processes.')
    add_labelled_figure(s,figs['sequence'],'Figure 5. Sequence for symptom intake, candidate prediction, persistence, and response.')
    add_labelled_figure(s,figs['usecase'],'Figure 6. Main patient and provider use cases represented by current routes and pages.')
    add_schema(s)
    add_labelled_figure(s,figs['er'],'Figure 7. Mongoose relationship summary. Embedded diagnosis subdocuments are omitted for readability.')
    s += [heading('8. Front End',0),p('The route map is defined in `frontend/src/routes/AppRouter.jsx`. `/` redirects to `/dashboard` for authenticated users and `/login` otherwise. The dashboard, diagnosis, profile, chatbot, and appointments pages are protected. No browser screenshot was generated in this report build; clearly marked screenshot placeholders are provided below.'),
          heading('Home / Symptom Input',1),p('The home workspace is the Dashboard page. Symptom entry and returned assessment are implemented by DiagnosisForm; the project does not have a distinct home or report component file.'),p('[Screenshot: Home / Dashboard]'),p('[Screenshot: Symptom Input and Prediction Report]'),
          heading('Prediction Report',1),p('DiagnosisForm renders the API assessment response, candidate information, safety advice, and disclaimer in the symptom workflow. It is not a separate route.'),
          heading('Doctor Consultations and Booking Details',1),p('The appointments route combines doctor discovery, slot selection, booking submission, and appointment details/status. There is no separate doctor directory page in the route map.'),p('[Screenshot: Doctor Consultations]'),p('[Screenshot: Booking Details]'),
          heading('Chatbot',1),p('The chatbot page keeps local message, symptom, and conversation state; it sends requests to the chat API and supports a handoff to appointments.'),p('[Screenshot: Chatbot]'),
          heading('Sign In and Sign Up',1),p('Login and Signup share the AuthShell component from Login.jsx and use AuthContext plus authService. They navigate into the dashboard after successful authentication.'),p('[Screenshot: Sign In]'),p('[Screenshot: Sign Up]')]
    front=[('frontend/src/pages/Dashboard.jsx','Dashboard workspace, health history, navigation, and page-level state.'),('frontend/src/pages/DiagnosisForm.jsx','Symptom input, request flow, assessment/report rendering, and handoff.'),('frontend/src/pages/Appointments.jsx','Doctor list, appointment form, and booking details/status.'),('frontend/src/pages/Chatbot.jsx','Chat interface, history, requests, suggestions, and triage result display.'),('frontend/src/pages/Login.jsx','Login view and reusable AuthShell.'),('frontend/src/pages/Signup.jsx','Registration view and client-side input checks.'),('frontend/src/routes/AppRouter.jsx','Actual page route composition and protected wrappers.')]
    for rel,desc in front: code_file(s,rel,desc,5.2)
    s += [heading('9. Back End',0),p('The following appendix-style listings are copied directly from the checked-in source files at report-generation time. They are grouped by path with a brief role statement. Secret-bearing environment files, package lock files, binary models, private control files, build output, and dependency folders are excluded. The two control `.example.json` files are represented only by one harmless example each.')]
    source_groups=[
      ('API entry point and utility',[('backend/server.js','Express application setup, routes, security middleware, database startup, and shutdown.'),('backend/utils/apiResponse.js','Standard success and error response envelopes.')]),
      ('Controllers',[('backend/controllers/authController.js','Registration, login, and credential/session orchestration.'),('backend/controllers/userController.js','Profile read and update operations.'),('backend/controllers/diagnosisController.js','Diagnosis prediction orchestration, persistence, history, detail, deletion, and symptom catalog.'),('backend/controllers/doctorController.js','Doctor availability and appointment orchestration. File path shown; live private control files are excluded.'),('backend/controllers/chatController.js','Chat request orchestration and response composition.')]),
      ('Services',[('backend/services/predictionService.js','Prediction provider selection, candidate engine, fallback behavior, and environment checks.'),('backend/services/geminiService.js','Gemini request construction, output validation, explanation and chat retry/fallback.'),('backend/services/mlService.js','Node symptom normalization, Python service bridge, and local heuristic fallback.'),('backend/services/chatEngine.js','Symptom extraction, emergency flags, conversational branches, and response structure.')]),
      ('Mongoose models',[('backend/models/User.js','User account and profile schema.'),('backend/models/Doctor.js','Doctor profile and availability schema.'),('backend/models/Appointment.js','Appointment schema and references.'),('backend/models/Diagnosis.js','Diagnosis, candidate, and insight schemas.')]),
      ('Routes and middleware',[('backend/routes/authRoutes.js','Registration and login validation and routes.'),('backend/routes/userRoutes.js','Protected profile endpoints.'),('backend/routes/diagnosisRoutes.js','Protected diagnosis lifecycle and public symptom endpoint.'),('backend/routes/doctorRoutes.js','Protected doctor and appointment endpoints.'),('backend/routes/chatRoutes.js','Chat route, optional auth, history normalization, and request validation.'),('backend/middleware/authMiddleware.js','JWT protection for authenticated routes.'),('backend/middleware/errorHandler.js','Central API exception handling.'),('backend/middleware/rateLimiter.js','Auth and chat rate limits.'),('backend/middleware/validateMiddleware.js','Express-validator response handling.'),('backend/config/constants.js','Shared application and provider constants; excludes secret values.')]),
      ('Python ML service and classifier',[('ml-service/app.py','Flask inference API, payload checks, feature encoding, and classifier call.'),('ml-service/model/classifier.py','Classifier wrapper used by the ML service.'),('ml-service/model/train.py','Model training pipeline.'),('ml-service/model/evaluate.py','Evaluation script and metric generation.')]),
      ('Safe control-file examples',[('backend/config/doctors-control.example.json','Only the first sample entry is shown.'),('backend/config/bookings-control.example.json','Only the checked-in generic sample booking is shown.')])]
    for group,files in source_groups:
        s.append(heading(group,1))
        for rel,desc in files:
            if rel.endswith('.example.json'):
                path=ROOT/rel
                try:
                    payload=json.loads(path.read_text(encoding='utf-8'))
                    sample={next(iter(payload)):next(iter(payload.values()))}
                    source=json.dumps(sample,indent=2,ensure_ascii=False)
                    s.append(heading(safe_text(rel),2)); s.append(p(escape(desc),'SmallX')); s.append(CodeBlock(source,5.3))
                except Exception:
                    s.append(p(f'Sample unavailable: {safe_text(rel)}','SmallX'))
            else:
                code_file(s,rel,desc,5.05 if rel.endswith('geminiService.js') else 5.25)
    s += [heading('10. Testing',0),p('The repository’s actual automated checks and this report-generation run are summarized below. Tests were executed from their own service directories. The aggregate Node `npm test` command was attempted, but this environment returned `spawn EPERM` when the Node test runner tried to start separate test-file processes; executing each actual test file directly worked.'),
          heading('Node backend tests',1),bullet('`backend/tests/geminiService.test.js`: 20 passed, 0 failed.'),bullet('`backend/tests/mlService.test.js`: 8 passed, 0 failed. The local ML service was not running; its expected connection failure exercised fallback behavior.'),bullet('`backend/tests/predictionService.test.js`: 15 passed, 0 failed.'),bullet('Direct Node test total: 43 passed, 0 failed. Aggregate `npm test`: runner failed at process spawn (`EPERM`), not an assertion failure.'),
          heading('Python ML tests',1),bullet('`python -m pytest -q` in `ml-service`: 12 passed. Pytest emitted a cache write warning for the workspace; assertions completed successfully.'),
          heading('Frontend checks',1),p('The repository does not define a frontend test script or a frontend test suite. No browser screenshot or UI test is claimed in this report.'),
          heading('Test coverage represented in source',1),p('The checked-in Node tests cover Gemini response parsing and sanitization, confidence interpretation, provider error classification, symptom normalization, ML service outage fallback, prediction-provider orchestration, and fallback behavior. Python tests exercise the ML prediction service. These tests do not establish clinical performance or production readiness.')]
    for rel in ['backend/tests/geminiService.test.js','backend/tests/mlService.test.js','backend/tests/predictionService.test.js','ml-service/tests/test_predict.py']:
        code_file(s,rel,'Verbatim checked-in test source.',5.2)
    s += [heading('11. Conclusion',0),p('Online Health Diagnosis System demonstrates a full-stack implementation connecting user-facing symptom workflows, protected APIs, database-backed records, provider integrations, and a separate machine-learning service. Its modular structure and tests support continued development. It remains a preliminary triage and educational tool; a qualified healthcare professional must assess medical concerns.'),
          heading('Future Scope',1),bullet('Add comprehensive frontend component and browser end-to-end tests, including accessibility review.'),bullet('Add structured audit trails, stronger appointment conflict handling, and clearer operational monitoring.'),bullet('Evaluate the classifier on independently sourced, representative data and publish transparent validation methodology.'),bullet('Add clinician-reviewed content and localized emergency information after jurisdiction-specific review.'),bullet('Complete deployment, privacy, threat-model, and regulatory assessments before any real clinical or patient-facing use.'),
          heading('Bibliography',1),bullet('Project source repository: `frontend/`, `backend/`, and `ml-service/` (implementation inspected for this report).'),bullet('Project requirements: `Docs/PRD.md`; architecture baseline: `Docs/ARCHITECTURE.md`; code rules and standards: `Docs/RULES.md` and `Docs/CODING_STANDARDS.md`.'),bullet('React documentation: https://react.dev/'),bullet('Express documentation: https://expressjs.com/'),bullet('Mongoose documentation: https://mongoosejs.com/docs/'),bullet('Flask documentation: https://flask.palletsprojects.com/'),bullet('scikit-learn documentation: https://scikit-learn.org/stable/'),bullet('Google Gemini API integration reference: https://ai.google.dev/gemini-api/docs (provider configured outside this report; no key included).'),
          Spacer(1,8),p('<b>Submission placeholders to complete:</b> [Student Full Name], [Mentor Name], [Company Name], [College/University Name], [Academic Year], signature lines, date, place, and all marked screenshots.', 'SmallX')]
    return s


def main():
    figs=build_figures()
    doc=ReportDoc(PDF_PATH)
    doc.multiBuild(create_story(figs))
    # Count pages from PDF page objects without adding another dependency.
    raw=PDF_PATH.read_bytes()
    pages=len(re.findall(rb'/Type\s*/Page\b',raw))
    print(json.dumps({'pdf':str(PDF_PATH),'pages':pages,'bytes':len(raw),'figures':len(list(FIG_DIR.glob('*.png')))}))


if __name__ == '__main__':
    main()

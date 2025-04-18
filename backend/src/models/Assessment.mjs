import mongoose from 'mongoose';

const AssessmentSchema = new mongoose.Schema(
  {
    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Patient',
      required: true,
      index: true
    },
    appointmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Appointment',
      required: true
    },
    symptoms: [String],
    generatedQuestions: [{
      questionId: String,
      question: String,
      answerType: {
        type: String,
        enum: ['text', 'boolean', 'select', 'scale', 'number'],
        default: 'text'
      },
      options: [String]
    }],
    responses: [{
      questionId: String,
      answer: mongoose.Schema.Types.Mixed
    }],
    aiGeneratedReport: {
      type: String
    },
    severity: {
      type: String,
      enum: ['low', 'medium', 'high', 'emergency'],
      default: 'low'
    },
    vitalSigns: {
      temperature: Number,
      bloodPressureSystolic: Number,
      bloodPressureDiastolic: Number,
      heartRate: Number,
      respiratoryRate: Number,
      oxygenSaturation: Number,
      weight: Number,
      height: Number,
      bmi: Number
    },
    creationDate: {
      type: Date,
      default: Date.now
    },
    completionDate: {
      type: Date
    },
    status: {
      type: String,
      enum: ['in-progress', 'completed', 'abandoned'],
      default: 'in-progress'
    }
  },
  {
    timestamps: true
  }
);

const Assessment = mongoose.model('Assessment', AssessmentSchema);
export default Assessment;
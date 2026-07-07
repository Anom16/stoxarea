from sqlalchemy import Column, Integer, String, Text, ForeignKey
from sqlalchemy.orm import relationship
from app.core.database import Base

class Question(Base):
    __tablename__ = "questions"

    id = Column(String(50), primary_key=True, index=True)  # e.g. 'q1', 'q2'
    category = Column(String(100), nullable=False)
    question = Column(Text, nullable=False)

    # Use cascade delete-orphan so when a question is deleted, its options are also deleted
    options = relationship("QuestionOption", back_populates="question", cascade="all, delete-orphan", lazy="joined")

class QuestionOption(Base):
    __tablename__ = "question_options"

    id = Column(Integer, primary_key=True, index=True)
    question_id = Column(String(50), ForeignKey("questions.id", ondelete="CASCADE"), nullable=False)
    value = Column(Integer, nullable=False)
    text = Column(Text, nullable=False)

    question = relationship("Question", back_populates="options")

from sqlalchemy import Column, Integer, String, Text, ForeignKey, DateTime, Boolean, Date
from sqlalchemy.orm import relationship
from database import Base
import datetime

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True)
    hashed_password = Column(String)
    is_admin = Column(Boolean, default=False)

    # Gamification
    xp = Column(Integer, default=0)
    level = Column(Integer, default=1)
    streak_count = Column(Integer, default=0)
    last_active_date = Column(Date, nullable=True)
    badges = Column(String, default="")  # comma-separated badge ids e.g. "first_step,ten_questions"

    messages = relationship("ChatMessage", back_populates="user")

class ChatMessage(Base):
    __tablename__ = "chat_messages"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    subject = Column(String)
    role = Column(String) # 'user' or 'assistant'
    content = Column(Text)
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)

    user = relationship("User", back_populates="messages")

class QuizResult(Base):
    __tablename__ = "quiz_results"

    id         = Column(Integer, primary_key=True, index=True)
    user_id    = Column(Integer, ForeignKey("users.id"))
    subject    = Column(String)
    topic      = Column(String)
    quiz_type  = Column(String)   # 'mcq', 'true_false', 'fill_blank', 'mixed'
    difficulty = Column(String)   # 'easy', 'medium', 'hard'
    score      = Column(Integer)  # number of correct answers
    total      = Column(Integer)  # total questions in quiz
    xp_earned  = Column(Integer, default=0)
    timestamp  = Column(DateTime, default=datetime.datetime.utcnow)

    user = relationship("User", foreign_keys=[user_id])

class FlashcardDeck(Base):
    __tablename__ = "flashcard_decks"

    id         = Column(Integer, primary_key=True, index=True)
    user_id    = Column(Integer, ForeignKey("users.id"))
    subject    = Column(String)
    topic      = Column(String)
    timestamp  = Column(DateTime, default=datetime.datetime.utcnow)

    user = relationship("User", foreign_keys=[user_id])
    cards = relationship("Flashcard", back_populates="deck", cascade="all, delete")

class Flashcard(Base):
    __tablename__ = "flashcards"

    id         = Column(Integer, primary_key=True, index=True)
    deck_id    = Column(Integer, ForeignKey("flashcard_decks.id"))
    front      = Column(Text)
    back       = Column(Text)

    deck = relationship("FlashcardDeck", back_populates="cards")

from fastapi import FastAPI, APIRouter, HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict, EmailStr
from typing import List, Optional
import uuid
from datetime import datetime, timezone, timedelta
import bcrypt
import jwt
from openai import AsyncOpenAI
from pdf_processor import WatizatPDFProcessor
from auto_responses import get_auto_response, format_auto_response_post
from help_locations import HELP_LOCATIONS, get_all_help_locations, get_help_locations_by_category
import math
from urllib.parse import urlparse
import aiohttp
import re
import random

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# Robust env handling for production deploys (Render/Railway/etc).
# Falls back to a safe local default; logs warning if missing.
mongo_url = os.environ.get('MONGO_URL') or 'mongodb://localhost:27017'
if not os.environ.get('MONGO_URL'):
    logging.basicConfig(level=logging.WARNING)
    logging.warning("MONGO_URL not set! Falling back to mongodb://localhost:27017 - configure it in your deploy environment.")
client = AsyncIOMotorClient(mongo_url, serverSelectionTimeoutMS=5000)

# Extrai o nome do banco de dados da URL ou usa DB_NAME
def get_database_name():
    db_name = os.environ.get('DB_NAME', '')
    if db_name and db_name != 'test_database':
        return db_name
    
    # Tenta extrair da MONGO_URL
    parsed = urlparse(mongo_url)
    if parsed.path and len(parsed.path) > 1:
        # Remove a barra inicial
        extracted_db = parsed.path.lstrip('/')
        # Remove parâmetros de query se existirem
        if '?' in extracted_db:
            extracted_db = extracted_db.split('?')[0]
        if extracted_db:
            return extracted_db
    
    # Fallback para o DB_NAME ou padrão
    return db_name if db_name else 'watizat_db'

db = client[get_database_name()]

app = FastAPI()

# CORS deve estar ANTES de tudo
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Permite todas as origens
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"]
)

api_router = APIRouter(prefix="/api")

@api_router.get("/")
async def root():
    return {"message": "Watizat API - Bem-vindo!"}

security = HTTPBearer()
JWT_SECRET = os.environ.get('JWT_SECRET', 'default_secret')
ALGORITHM = "HS256"

pdf_processor = WatizatPDFProcessor()

class User(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    email: EmailStr
    name: str
    display_name: Optional[str] = None
    use_display_name: bool = False
    role: str
    location: Optional[dict] = None
    bio: Optional[str] = None
    languages: List[str] = Field(default_factory=list)
    categories: List[str] = Field(default_factory=list)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class UserRegister(BaseModel):
    email: EmailStr
    password: str
    name: str
    role: str
    languages: List[str] = Field(default_factory=list)
    professional_area: Optional[str] = None
    professional_specialties: Optional[List[str]] = Field(default_factory=list)
    availability: Optional[str] = None
    experience: Optional[str] = None
    education: Optional[str] = None
    certifications: Optional[List[str]] = Field(default_factory=list)
    professional_id: Optional[str] = None
    organization: Optional[str] = None
    years_experience: Optional[str] = None
    help_types: Optional[List[str]] = Field(default_factory=list)
    help_categories: Optional[List[str]] = Field(default_factory=list)  # Categorias de ajuda que voluntário oferece
    need_categories: Optional[List[str]] = Field(default_factory=list)  # Categorias de ajuda que migrante precisa
    phone: Optional[str] = None
    linkedin: Optional[str] = None
    location: Optional[dict] = None  # {lat: float, lng: float, address: str}
    show_location: bool = False  # Se quer mostrar localização no feed

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class Post(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    type: str
    category: str  # Categoria principal
    categories: List[str] = Field(default_factory=list)  # Múltiplas categorias
    title: str
    description: str
    location: Optional[dict] = None
    images: List[str] = Field(default_factory=list)
    videos: List[str] = Field(default_factory=list)
    budget: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class PostCreate(BaseModel):
    type: str
    category: str  # Categoria principal
    categories: Optional[List[str]] = Field(default_factory=list)  # Múltiplas categorias (até 3)
    title: str
    description: str
    location: Optional[dict] = None
    images: Optional[List[str]] = Field(default_factory=list)
    videos: Optional[List[str]] = Field(default_factory=list)
    budget: Optional[str] = None

class PostComment(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    post_id: str
    user_id: str
    comment: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class Advertisement(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    type: str  # 'motivation', 'donation', 'sponsor'
    title: str
    content: str
    image_url: Optional[str] = None
    link_url: Optional[str] = None
    link_text: Optional[str] = None
    is_active: bool = True
    priority: int = 0  # Higher = more important
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class AdvertisementCreate(BaseModel):
    type: str
    title: str
    content: str
    image_url: Optional[str] = None
    link_url: Optional[str] = None
    link_text: Optional[str] = None
    is_active: bool = True
    priority: int = 0


class PostCommentCreate(BaseModel):
    comment: str

class Service(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    category: str
    description: str
    address: Optional[str] = None
    phone: Optional[str] = None
    location: Optional[dict] = None
    hours: Optional[str] = None

class AIMessage(BaseModel):
    message: str
    language: str = "pt"

class Match(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    helper_id: str
    migrant_id: str
    status: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# Housing Models
class HousingListing(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    listing_type: str  # 'offer' or 'need'
    title: str
    description: Optional[str] = None
    city: str
    address: Optional[str] = None
    accommodation_type: str = 'room'  # room, sofa, house, shared
    duration: str = 'temporary'  # emergency, temporary, long_term, exchange
    max_guests: int = 1
    amenities: List[str] = []
    pets_allowed: bool = False
    available_from: Optional[str] = None
    available_until: Optional[str] = None
    exchange_services: Optional[str] = None
    photos: List[str] = []
    listing_status: str = 'active'  # active, matched, closed
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class HousingListingCreate(BaseModel):
    listing_type: str
    title: str
    description: Optional[str] = None
    city: str
    address: Optional[str] = None
    accommodation_type: str = 'room'
    duration: str = 'temporary'
    max_guests: int = 1
    amenities: List[str] = []
    pets_allowed: bool = False
    available_from: Optional[str] = None
    available_until: Optional[str] = None
    exchange_services: Optional[str] = None
    photos: List[str] = []

def create_token(user_id: str, email: str) -> str:
    payload = {
        'user_id': user_id,
        'email': email,
        'exp': datetime.now(timezone.utc) + timedelta(days=30)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=ALGORITHM)

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        token = credentials.credentials
        payload = jwt.decode(token, JWT_SECRET, algorithms=[ALGORITHM])
        user_id = payload.get('user_id')
        
        user = await db.users.find_one({'id': user_id}, {'_id': 0})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        return User(**user)
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")

@api_router.post("/auth/register")
async def register(user_data: UserRegister):
    existing = await db.users.find_one({'email': user_data.email}, {'_id': 0})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    hashed_pw = bcrypt.hashpw(user_data.password.encode(), bcrypt.gensalt())
    
    user = User(
        email=user_data.email,
        name=user_data.name,
        role=user_data.role,
        languages=user_data.languages
    )
    
    user_dict = user.model_dump()
    user_dict['password'] = hashed_pw.decode()
    user_dict['created_at'] = user_dict['created_at'].isoformat()
    
    if user_data.role == 'volunteer':
        user_dict['professional_area'] = user_data.professional_area
        user_dict['professional_specialties'] = user_data.professional_specialties or []
        user_dict['availability'] = user_data.availability
        user_dict['experience'] = user_data.experience
        user_dict['education'] = user_data.education
        user_dict['certifications'] = user_data.certifications or []
        user_dict['professional_id'] = user_data.professional_id
        user_dict['organization'] = user_data.organization
        user_dict['years_experience'] = user_data.years_experience
        user_dict['help_types'] = user_data.help_types or []
        user_dict['help_categories'] = user_data.help_categories or []
        user_dict['phone'] = user_data.phone
        user_dict['linkedin'] = user_data.linkedin
        user_dict['location'] = user_data.location
        user_dict['show_location'] = user_data.show_location
    
    if user_data.role == 'migrant':
        user_dict['need_categories'] = user_data.need_categories or []
        user_dict['location'] = user_data.location
        user_dict['show_location'] = user_data.show_location
    
    if user_data.role == 'helper':
        user_dict['help_categories'] = user_data.help_categories or []
        user_dict['location'] = user_data.location
        user_dict['show_location'] = user_data.show_location
    
    await db.users.insert_one(user_dict)
    
    token = create_token(user.id, user.email)
    return {'token': token, 'user': user}

@api_router.post("/auth/login")
async def login(credentials: UserLogin):
    user_data = await db.users.find_one({'email': credentials.email}, {'_id': 0})
    
    if not user_data:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    if not bcrypt.checkpw(credentials.password.encode(), user_data['password'].encode()):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    user_data.pop('password')
    if isinstance(user_data['created_at'], str):
        user_data['created_at'] = datetime.fromisoformat(user_data['created_at'])
    
    user = User(**user_data)
    token = create_token(user.id, user.email)
    
    return {'token': token, 'user': user}

@api_router.get("/profile")
async def get_profile(current_user: User = Depends(get_current_user)):
    return current_user

@api_router.put("/profile")
async def update_profile(updates: dict, current_user: User = Depends(get_current_user)):
    allowed_fields = ['name', 'bio', 'location', 'languages', 'categories', 'help_categories', 'need_categories', 'display_name', 'use_display_name']
    update_data = {k: v for k, v in updates.items() if k in allowed_fields}
    
    await db.users.update_one({'id': current_user.id}, {'$set': update_data})
    
    updated_user = await db.users.find_one({'id': current_user.id}, {'_id': 0, 'password': 0})
    if isinstance(updated_user['created_at'], str):
        updated_user['created_at'] = datetime.fromisoformat(updated_user['created_at'])
    
    return User(**updated_user)

@api_router.post("/posts", response_model=Post)
async def create_post(post_data: PostCreate, current_user: User = Depends(get_current_user)):
    # Se não há categorias múltiplas, usar a categoria principal
    categories_list = post_data.categories if post_data.categories else [post_data.category]
    
    post = Post(
        user_id=current_user.id,
        type=post_data.type,
        category=post_data.category,
        categories=categories_list,
        title=post_data.title,
        description=post_data.description,
        location=post_data.location,
        images=post_data.images or [],
        videos=post_data.videos or [],
        budget=post_data.budget
    )
    
    post_dict = post.model_dump()
    post_dict['created_at'] = post_dict['created_at'].isoformat()
    
    await db.posts.insert_one(post_dict)
    
    # Enviar resposta automática para cada categoria selecionada
    if post_data.type == 'need':
        for cat in categories_list:
            auto_response = get_auto_response(cat)
            if auto_response:
                message_data = {
                    'id': str(uuid.uuid4()),
                    'from_user_id': 'system',
                    'to_user_id': current_user.id,
                    'message': f"{auto_response['title']}\n\n{auto_response['content']}",
                    'created_at': datetime.now(timezone.utc).isoformat(),
                    'is_auto_response': True
                }
                await db.messages.insert_one(message_data)
    
    return post

@api_router.post("/posts/{post_id}/comments")
async def add_comment(post_id: str, comment_data: PostCommentCreate, current_user: User = Depends(get_current_user)):
    comment = PostComment(
        post_id=post_id,
        user_id=current_user.id,
        comment=comment_data.comment
    )
    
    comment_dict = comment.model_dump()
    comment_dict['created_at'] = comment_dict['created_at'].isoformat()
    
    await db.comments.insert_one(comment_dict)
    return comment

@api_router.get("/posts/{post_id}/comments")
async def get_comments(post_id: str):
    comments = await db.comments.find({'post_id': post_id}, {'_id': 0}).sort('created_at', 1).to_list(1000)

    # Batch fetch users to avoid N+1
    user_ids = list({c['user_id'] for c in comments})
    users_dict = {}
    if user_ids:
        async for u in db.users.find({'id': {'$in': user_ids}}, {'_id': 0, 'password': 0, 'email': 0}):
            users_dict[u['id']] = u

    for comment in comments:
        if isinstance(comment['created_at'], str):
            comment['created_at'] = datetime.fromisoformat(comment['created_at'])
        user = users_dict.get(comment['user_id'])
        if user:
            comment['user'] = {'name': user['name'], 'role': user['role']}

    return comments

@api_router.get("/posts")
async def get_posts(type: Optional[str] = None, category: Optional[str] = None, current_user: User = Depends(get_current_user)):
    query = {}
    if type:
        query['type'] = type
    if category:
        # Buscar posts que tenham a categoria (principal ou nas múltiplas)
        query['$or'] = [
            {'category': category},
            {'categories': category}
        ]
    
    posts = await db.posts.find(query, {'_id': 0}).sort('created_at', -1).to_list(100)
    
    # Se o usuário é voluntário, marcar posts que ele pode ajudar baseado nas categorias
    user_data = await db.users.find_one({'id': current_user.id}, {'_id': 0})
    user_help_categories = user_data.get('help_categories', []) if user_data else []
    
    # Batch fetch all unique user_ids to avoid N+1 queries
    user_ids = list(set(post['user_id'] for post in posts if post['user_id'] != 'system'))
    users_dict = {}
    if user_ids:
        users_cursor = db.users.find({'id': {'$in': user_ids}}, {'_id': 0, 'password': 0, 'email': 0})
        async for user in users_cursor:
            users_dict[user['id']] = user
    
    filtered_posts = []
    for post in posts:
        if isinstance(post['created_at'], str):
            post['created_at'] = datetime.fromisoformat(post['created_at'])
        
        if post['user_id'] == 'system':
            post['user'] = {'name': 'Watizat Assistant', 'role': 'assistant'}
        else:
            user = users_dict.get(post['user_id'])
            if user:
                display_name = user.get('display_name') if user.get('use_display_name') else user['name']
                post['user'] = {'name': display_name, 'role': user['role']}
        
        # Garantir que posts tenham campo categories
        if 'categories' not in post or not post['categories']:
            post['categories'] = [post['category']] if post.get('category') else []
        
        # Se é voluntário ou helper e o post é do tipo "need" (precisa de ajuda)
        # só mostrar se alguma categoria do post está nas categorias que ele pode ajudar
        if current_user.role in ['volunteer', 'helper']:
            if post['type'] == 'need':
                post_categories = post.get('categories', [post.get('category')])
                # Se não tem categorias definidas ou alguma categoria do post está nas dele
                if not user_help_categories or any(cat in user_help_categories for cat in post_categories):
                    post['can_help'] = True
                    filtered_posts.append(post)
            else:
                # Posts de oferta (type='offer') todos podem ver
                post['can_help'] = True
                filtered_posts.append(post)
        else:
            # Migrantes e outros usuários veem todos os posts
            post['can_help'] = True
            filtered_posts.append(post)
    
    return filtered_posts

@api_router.get("/services")
async def get_services(category: Optional[str] = None):
    query = {}
    if category:
        query['category'] = category
    
    services = await db.services.find(query, {'_id': 0}).to_list(100)
    return services

@api_router.post("/ai/chat")
async def ai_chat(message_data: AIMessage, current_user: User = Depends(get_current_user)):
    try:
        # Verificar se a chave OpenAI está configurada
        openai_key = os.environ.get('OPENAI_API_KEY')
        
        if not openai_key:
            # Retornar resposta baseada no guia Watizat sem IA
            pdf_processor.load_index()
            relevant_chunks = pdf_processor.search(message_data.message, k=3)
            
            if relevant_chunks:
                context_response = f"""Encontrei as seguintes informações no Guia Watizat que podem ajudar:

{chr(10).join([f"• {chunk[:300]}..." if len(chunk) > 300 else f"• {chunk}" for chunk in relevant_chunks[:3]])}

Para mais informações, consulte o Guia Watizat completo ou entre em contato com um voluntário."""
            else:
                context_response = """Não encontrei informações específicas sobre sua pergunta no guia.

Você pode:
• Criar um post na seção "Preciso de Ajuda"
• Entrar em contato com voluntários disponíveis
• Consultar os locais de ajuda no mapa

Estamos aqui para ajudar!"""
            
            chat_record = {
                'id': str(uuid.uuid4()),
                'user_id': current_user.id,
                'message': message_data.message,
                'response': context_response,
                'language': message_data.language,
                'ai_enabled': False,
                'created_at': datetime.now(timezone.utc).isoformat()
            }
            await db.ai_chats.insert_one(chat_record)
            
            return {'response': context_response, 'sources': relevant_chunks[:2] if relevant_chunks else [], 'ai_enabled': False}
        
        # Com chave OpenAI - usar IA
        pdf_processor.load_index()
        relevant_chunks = pdf_processor.search(message_data.message, k=3)
        
        context = "\n\n".join(relevant_chunks) if relevant_chunks else "Informação não encontrada no guia Watizat."
        
        system_message = f"""Você é um assistente especializado em ajudar migrantes em Paris. 
        Use as informações do guia Watizat abaixo para responder perguntas.
        Seja empático, claro e objetivo. Responda em {message_data.language}.
        
        Contexto do Watizat:
        {context}
        """
        
        # Usar OpenAI diretamente
        openai_client = AsyncOpenAI(
            api_key=openai_key
        )
        
        response = await openai_client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": system_message},
                {"role": "user", "content": message_data.message}
            ],
            temperature=0.7,
            max_tokens=1000
        )
        
        ai_response = response.choices[0].message.content
        
        chat_record = {
            'id': str(uuid.uuid4()),
            'user_id': current_user.id,
            'message': message_data.message,
            'response': ai_response,
            'language': message_data.language,
            'ai_enabled': True,
            'created_at': datetime.now(timezone.utc).isoformat()
        }
        await db.ai_chats.insert_one(chat_record)
        
        return {'response': ai_response, 'sources': relevant_chunks[:2] if relevant_chunks else [], 'ai_enabled': True}
    
    except Exception as e:
        logging.error(f"AI Chat error: {str(e)}")
        raise HTTPException(status_code=500, detail="Error processing message")

@api_router.post("/matches")
async def create_match(helper_id: str, current_user: User = Depends(get_current_user)):
    if current_user.role != 'migrant':
        raise HTTPException(status_code=400, detail="Only migrants can create matches")
    
    match = Match(
        helper_id=helper_id,
        migrant_id=current_user.id,
        status='pending'
    )
    
    match_dict = match.model_dump()
    match_dict['created_at'] = match_dict['created_at'].isoformat()
    
    await db.matches.insert_one(match_dict)
    return match

@api_router.get("/matches")
async def get_matches(current_user: User = Depends(get_current_user)):
    query = {}
    if current_user.role == 'migrant':
        query['migrant_id'] = current_user.id
    else:
        query['helper_id'] = current_user.id
    
    matches = await db.matches.find(query, {'_id': 0}).to_list(100)
    return matches

@api_router.get("/admin/stats")
async def admin_stats(current_user: User = Depends(get_current_user)):
    if current_user.role != 'admin':
        raise HTTPException(status_code=403, detail="Admin only")
    
    total_users = await db.users.count_documents({})
    total_posts = await db.posts.count_documents({})
    total_matches = await db.matches.count_documents({})
    total_volunteers = await db.users.count_documents({'role': 'volunteer'})
    total_migrants = await db.users.count_documents({'role': 'migrant'})
    total_messages = await db.messages.count_documents({})
    
    # Posts por categoria
    posts_by_category = {}
    categories = ['food', 'legal', 'health', 'housing', 'work', 'education', 'social', 'clothes', 'furniture', 'transport']
    for cat in categories:
        count = await db.posts.count_documents({'category': cat})
        posts_by_category[cat] = count
    
    # Posts por tipo
    needs_count = await db.posts.count_documents({'type': 'need'})
    offers_count = await db.posts.count_documents({'type': 'offer'})
    
    return {
        'total_users': total_users,
        'total_posts': total_posts,
        'total_matches': total_matches,
        'total_volunteers': total_volunteers,
        'total_migrants': total_migrants,
        'total_messages': total_messages,
        'posts_by_category': posts_by_category,
        'needs_count': needs_count,
        'offers_count': offers_count
    }

@api_router.get("/admin/users")
async def admin_get_users(current_user: User = Depends(get_current_user)):
    if current_user.role != 'admin':
        raise HTTPException(status_code=403, detail="Admin only")
    
    users = await db.users.find({}, {'_id': 0, 'password': 0}).sort('created_at', -1).to_list(1000)
    
    for user in users:
        if isinstance(user.get('created_at'), str):
            user['created_at'] = datetime.fromisoformat(user['created_at'])
    
    return users

@api_router.get("/admin/posts")
async def admin_get_posts(current_user: User = Depends(get_current_user)):
    if current_user.role != 'admin':
        raise HTTPException(status_code=403, detail="Admin only")
    
    posts = await db.posts.find({}, {'_id': 0}).sort('created_at', -1).to_list(1000)
    
    # Batch fetch all unique user_ids to avoid N+1 queries
    user_ids = list(set(post['user_id'] for post in posts if post.get('user_id')))
    users_dict = {}
    if user_ids:
        users_cursor = db.users.find({'id': {'$in': user_ids}}, {'_id': 0, 'password': 0, 'email': 0})
        async for user in users_cursor:
            users_dict[user['id']] = user
    
    for post in posts:
        if isinstance(post.get('created_at'), str):
            post['created_at'] = datetime.fromisoformat(post['created_at'])
        # Get user info from batch
        user = users_dict.get(post.get('user_id'))
        if user:
            post['user'] = {'name': user['name'], 'role': user['role']}
    
    return posts

@api_router.delete("/admin/users/{user_id}")
async def admin_delete_user(user_id: str, current_user: User = Depends(get_current_user)):
    if current_user.role != 'admin':
        raise HTTPException(status_code=403, detail="Admin only")
    
    # Don't allow deleting yourself
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot delete yourself")
    
    result = await db.users.delete_one({'id': user_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Also delete user's posts and messages
    await db.posts.delete_many({'user_id': user_id})
    await db.messages.delete_many({'$or': [{'from_user_id': user_id}, {'to_user_id': user_id}]})
    
    return {'message': 'User deleted successfully'}

@api_router.delete("/admin/posts/{post_id}")
async def admin_delete_post(post_id: str, current_user: User = Depends(get_current_user)):
    if current_user.role != 'admin':
        raise HTTPException(status_code=403, detail="Admin only")
    
    result = await db.posts.delete_one({'id': post_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Post not found")
    
    # Also delete comments
    await db.comments.delete_many({'post_id': post_id})
    
    return {'message': 'Post deleted successfully'}

@api_router.put("/admin/users/{user_id}/role")
async def admin_update_user_role(user_id: str, role_data: dict, current_user: User = Depends(get_current_user)):
    if current_user.role != 'admin':
        raise HTTPException(status_code=403, detail="Admin only")
    
    new_role = role_data.get('role')
    if new_role not in ['migrant', 'volunteer', 'helper', 'admin']:
        raise HTTPException(status_code=400, detail="Invalid role")
    
    result = await db.users.update_one({'id': user_id}, {'$set': {'role': new_role}})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    
    return {'message': 'Role updated successfully'}

class DirectMessage(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    from_user_id: str
    to_user_id: str
    message: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class DirectMessageCreate(BaseModel):
    to_user_id: str
    message: str
    location: Optional[dict] = None
    media: Optional[List[str]] = Field(default_factory=list)
    media_type: Optional[str] = None

@api_router.post("/messages")
async def send_message(msg_data: DirectMessageCreate, current_user: User = Depends(get_current_user)):
    message = DirectMessage(
        from_user_id=current_user.id,
        to_user_id=msg_data.to_user_id,
        message=msg_data.message
    )
    
    msg_dict = message.model_dump()
    msg_dict['created_at'] = msg_dict['created_at'].isoformat()
    msg_dict['location'] = msg_data.location
    msg_dict['media'] = msg_data.media or []
    msg_dict['media_type'] = msg_data.media_type
    
    await db.messages.insert_one(msg_dict)
    return message

@api_router.get("/messages/{other_user_id}")
async def get_messages(other_user_id: str, current_user: User = Depends(get_current_user)):
    messages = await db.messages.find({
        '$or': [
            {'from_user_id': current_user.id, 'to_user_id': other_user_id},
            {'from_user_id': other_user_id, 'to_user_id': current_user.id}
        ]
    }, {'_id': 0}).sort('created_at', 1).to_list(1000)
    
    for msg in messages:
        if isinstance(msg['created_at'], str):
            msg['created_at'] = datetime.fromisoformat(msg['created_at'])
    
    return messages

@api_router.get("/conversations")
async def get_conversations(current_user: User = Depends(get_current_user)):
    messages = await db.messages.find({
        '$or': [
            {'from_user_id': current_user.id},
            {'to_user_id': current_user.id}
        ]
    }, {'_id': 0}).to_list(10000)
    
    user_ids = set()
    for msg in messages:
        if msg['from_user_id'] != current_user.id:
            user_ids.add(msg['from_user_id'])
        if msg['to_user_id'] != current_user.id:
            user_ids.add(msg['to_user_id'])
    
    # Batch fetch all users to avoid N+1 queries
    user_ids_list = list(user_ids)
    users_dict = {}
    if user_ids_list:
        users_cursor = db.users.find({'id': {'$in': user_ids_list}}, {'_id': 0, 'password': 0})
        async for user in users_cursor:
            users_dict[user['id']] = user
    
    # Get last messages for each conversation in batch
    last_messages = {}
    for uid in user_ids_list:
        relevant_msgs = [m for m in messages if 
            (m['from_user_id'] == uid and m['to_user_id'] == current_user.id) or
            (m['from_user_id'] == current_user.id and m['to_user_id'] == uid)]
        if relevant_msgs:
            # Sort by created_at and get last one
            sorted_msgs = sorted(relevant_msgs, key=lambda x: x.get('created_at', ''), reverse=True)
            last_messages[uid] = sorted_msgs[0]
    
    conversations = []
    for uid in user_ids:
        user = users_dict.get(uid)
        if user:
            if isinstance(user.get('created_at'), str):
                user['created_at'] = datetime.fromisoformat(user['created_at'])
            
            last_msg = last_messages.get(uid)
            conversations.append({
                'user': user,
                'last_message': last_msg['message'] if last_msg else '',
                'last_message_time': last_msg['created_at'] if last_msg else None
            })
    
    return conversations

@api_router.get("/users/{user_id}")
async def get_user_by_id(user_id: str, current_user: User = Depends(get_current_user)):
    user = await db.users.find_one({'id': user_id}, {'_id': 0, 'password': 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if isinstance(user.get('created_at'), str):
        user['created_at'] = datetime.fromisoformat(user['created_at'])
    
    return user

@api_router.get("/can-chat/{other_user_id}")
async def can_chat_with_user(other_user_id: str, current_user: User = Depends(get_current_user)):
    """
    Verifica se o usuário atual pode iniciar chat com outro usuário.
    Para voluntários e helpers, só podem conversar com migrantes se tiverem categorias de ajuda compatíveis.
    """
    other_user = await db.users.find_one({'id': other_user_id}, {'_id': 0})
    if not other_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    current_user_data = await db.users.find_one({'id': current_user.id}, {'_id': 0})
    
    # Migrantes podem conversar com qualquer voluntário ou helper
    if current_user.role == 'migrant':
        return {'can_chat': True, 'reason': 'allowed'}
    
    # Voluntários e helpers só podem conversar com migrantes se tiverem categorias compatíveis
    if current_user.role in ['volunteer', 'helper'] and other_user.get('role') == 'migrant':
        helper_categories = current_user_data.get('help_categories', []) if current_user_data else []
        
        if not helper_categories:
            # Se não definiu categorias, permitir chat (legacy)
            return {'can_chat': True, 'reason': 'no_categories_defined'}
        
        # Primeiro verificar need_categories do migrante
        migrant_need_categories = other_user.get('need_categories', [])
        
        if migrant_need_categories:
            # Verificar match entre need_categories do migrante e help_categories
            for cat in migrant_need_categories:
                if cat in helper_categories:
                    return {'can_chat': True, 'reason': 'category_match', 'matching_category': cat}
        
        # Se migrante não tem need_categories, verificar pelos posts
        migrant_posts = await db.posts.find({'user_id': other_user_id, 'type': 'need'}, {'_id': 0}).to_list(100)
        
        if not migrant_posts and not migrant_need_categories:
            # Se o migrante não tem posts nem need_categories, permitir chat
            return {'can_chat': True, 'reason': 'no_needs_defined'}
        
        # Verificar se há algum post do migrante em categoria que pode ajudar
        for post in migrant_posts:
            if post.get('category') in helper_categories:
                return {'can_chat': True, 'reason': 'category_match', 'matching_category': post.get('category')}
        
        return {'can_chat': False, 'reason': 'no_matching_categories'}
    
    # Outros casos: permitir
    return {'can_chat': True, 'reason': 'allowed'}

@api_router.get("/volunteers")
async def get_volunteers(area: Optional[str] = None):
    query = {'role': 'volunteer'}
    if area:
        query['professional_area'] = area
    
    volunteers = await db.users.find(query, {'_id': 0, 'password': 0, 'email': 0}).to_list(1000)
    
    for vol in volunteers:
        if isinstance(vol.get('created_at'), str):
            vol['created_at'] = datetime.fromisoformat(vol['created_at'])
    
    return volunteers

@api_router.get("/helpers-nearby")
async def get_helpers_nearby(
    lat: float, 
    lng: float, 
    category: Optional[str] = None,
    radius: float = 10.0,  # km
    current_user: User = Depends(get_current_user)
):
    """
    Busca helpers e voluntários próximos que podem ajudar em uma categoria específica.
    Usa fórmula de Haversine para calcular distância.
    """
    import math
    
    def haversine_distance(lat1, lon1, lat2, lon2):
        R = 6371  # Raio da Terra em km
        phi1 = math.radians(lat1)
        phi2 = math.radians(lat2)
        delta_phi = math.radians(lat2 - lat1)
        delta_lambda = math.radians(lon2 - lon1)
        
        a = math.sin(delta_phi/2)**2 + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda/2)**2
        c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
        
        return R * c
    
    # Buscar helpers e voluntários com localização visível
    query = {
        'role': {'$in': ['helper', 'volunteer']},
        'show_location': True,
        'location': {'$ne': None}
    }
    
    if category:
        query['help_categories'] = category
    
    users = await db.users.find(query, {'_id': 0, 'password': 0, 'email': 0}).to_list(1000)
    
    nearby_users = []
    for user in users:
        if user.get('location') and user['location'].get('lat') and user['location'].get('lng'):
            distance = haversine_distance(
                lat, lng,
                user['location']['lat'],
                user['location']['lng']
            )
            if distance <= radius:
                user['distance'] = round(distance, 2)
                if isinstance(user.get('created_at'), str):
                    user['created_at'] = datetime.fromisoformat(user['created_at'])
                nearby_users.append(user)
    
    # Ordenar por distância
    nearby_users.sort(key=lambda x: x['distance'])
    
    return nearby_users

@api_router.put("/profile/location")
async def update_location(location_data: dict, current_user: User = Depends(get_current_user)):
    """Atualiza a localização do usuário"""
    update = {
        'location': location_data.get('location'),
        'show_location': location_data.get('show_location', False)
    }
    
    await db.users.update_one({'id': current_user.id}, {'$set': update})
    return {'message': 'Location updated successfully'}

# ==================== HELP LOCATIONS ENDPOINTS ====================

def calculate_distance(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Calcula a distância em km entre duas coordenadas usando a fórmula de Haversine"""
    R = 6371  # Raio da Terra em km
    
    lat1_rad = math.radians(lat1)
    lat2_rad = math.radians(lat2)
    delta_lat = math.radians(lat2 - lat1)
    delta_lng = math.radians(lng2 - lng1)
    
    a = math.sin(delta_lat/2)**2 + math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(delta_lng/2)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
    
    return R * c

class HelpLocationResponse(BaseModel):
    id: str
    name: str
    address: str
    phone: Optional[str]
    category: str
    hours: Optional[str]
    lat: float
    lng: float
    distance: Optional[float] = None
    icon: Optional[str] = None
    color: Optional[str] = None

CATEGORY_ICONS = {
    'food': {'icon': '🍽️', 'color': 'bg-green-500'},
    'health': {'icon': '🏥', 'color': 'bg-red-500'},
    'legal': {'icon': '⚖️', 'color': 'bg-blue-500'},
    'housing': {'icon': '🏠', 'color': 'bg-purple-500'},
    'clothes': {'icon': '👕', 'color': 'bg-orange-500'},
    'social': {'icon': '🤝', 'color': 'bg-pink-500'},
    'education': {'icon': '📚', 'color': 'bg-indigo-500'},
    'work': {'icon': '💼', 'color': 'bg-yellow-500'}
}

@api_router.get("/help-locations")
async def get_help_locations(
    category: Optional[str] = None,
    lat: Optional[float] = None,
    lng: Optional[float] = None
):
    """
    Retorna todos os locais de ajuda.
    Pode filtrar por categoria e ordenar por distância se coordenadas forem fornecidas.
    """
    # Buscar locais do arquivo de dados
    if category and category != 'all':
        locations = get_help_locations_by_category(category)
    else:
        locations = get_all_help_locations()
    
    # Adicionar ícones e cores
    result = []
    for loc in locations:
        loc_data = {**loc}
        cat_info = CATEGORY_ICONS.get(loc['category'], {'icon': '📍', 'color': 'bg-gray-500'})
        loc_data['icon'] = cat_info['icon']
        loc_data['color'] = cat_info['color']
        
        # Calcular distância se coordenadas foram fornecidas
        if lat is not None and lng is not None:
            loc_data['distance'] = round(calculate_distance(lat, lng, loc['lat'], loc['lng']), 2)
        
        result.append(loc_data)
    
    # Ordenar por distância se aplicável
    if lat is not None and lng is not None:
        result.sort(key=lambda x: x.get('distance', float('inf')))
    
    return {'locations': result, 'total': len(result)}

@api_router.get("/help-locations/nearest")
async def get_nearest_help_location(
    lat: float,
    lng: float,
    category: Optional[str] = None
):
    """
    Retorna o local de ajuda mais próximo das coordenadas fornecidas.
    Pode filtrar por categoria.
    """
    if category and category != 'all':
        locations = get_help_locations_by_category(category)
    else:
        locations = get_all_help_locations()
    
    if not locations:
        raise HTTPException(status_code=404, detail="Nenhum local encontrado")
    
    nearest = None
    min_distance = float('inf')
    
    for loc in locations:
        distance = calculate_distance(lat, lng, loc['lat'], loc['lng'])
        if distance < min_distance:
            min_distance = distance
            cat_info = CATEGORY_ICONS.get(loc['category'], {'icon': '📍', 'color': 'bg-gray-500'})
            nearest = {
                **loc,
                'distance': round(distance, 2),
                'icon': cat_info['icon'],
                'color': cat_info['color']
            }
    
    return {'nearest': nearest}

@api_router.get("/help-locations/categories")
async def get_help_location_categories():
    """Retorna todas as categorias disponíveis com contagem de locais"""
    locations = get_all_help_locations()
    
    # Contar locais por categoria
    category_counts = {}
    for loc in locations:
        cat = loc['category']
        category_counts[cat] = category_counts.get(cat, 0) + 1
    
    # Formatar resposta com ícones
    categories = [
        {'value': 'all', 'label': 'Todos', 'icon': '🗺️', 'count': len(locations)}
    ]
    
    category_labels = {
        'food': 'Alimentação',
        'health': 'Saúde',
        'legal': 'Jurídico',
        'housing': 'Moradia',
        'clothes': 'Roupas',
        'social': 'Social',
        'education': 'Educação',
        'work': 'Trabalho'
    }
    
    for cat, count in sorted(category_counts.items()):
        cat_info = CATEGORY_ICONS.get(cat, {'icon': '📍', 'color': 'bg-gray-500'})
        categories.append({
            'value': cat,
            'label': category_labels.get(cat, cat.title()),
            'icon': cat_info['icon'],
            'color': cat_info['color'],
            'count': count
        })
    
    return {'categories': categories}

@api_router.post("/help-locations/seed")
async def seed_help_locations():
    """Popula o banco de dados com os locais de ajuda (operação única)"""
    locations = get_all_help_locations()
    
    # Verificar se já existem locais no banco
    existing_count = await db.help_locations.count_documents({})
    
    if existing_count > 0:
        return {'message': f'{existing_count} locais já existem no banco', 'seeded': False}
    
    # Inserir todos os locais
    for loc in locations:
        loc_with_metadata = {
            **loc,
            'created_at': datetime.now(timezone.utc)
        }
        await db.help_locations.insert_one(loc_with_metadata)
    
    return {'message': f'{len(locations)} locais adicionados com sucesso', 'seeded': True, 'count': len(locations)}

# ==================== ADVERTISEMENTS ENDPOINTS ====================

@api_router.get("/advertisements")
async def get_advertisements(type: Optional[str] = None, active_only: bool = True):
    """Retorna anúncios/divulgações para exibir na sidebar"""
    query = {}
    if type:
        query['type'] = type
    if active_only:
        query['is_active'] = True
    
    ads = await db.advertisements.find(query, {'_id': 0}).sort('priority', -1).to_list(50)
    return ads

@api_router.post("/admin/advertisements")
async def create_advertisement(ad_data: AdvertisementCreate, current_user: User = Depends(get_current_user)):
    """Cria um novo anúncio (admin only)"""
    if current_user.role != 'admin':
        raise HTTPException(status_code=403, detail="Admin only")
    
    ad = Advertisement(**ad_data.model_dump())
    ad_dict = ad.model_dump()
    
    await db.advertisements.insert_one(ad_dict)
    return {'message': 'Anúncio criado com sucesso', 'id': ad.id}

@api_router.get("/admin/advertisements")
async def admin_get_advertisements(current_user: User = Depends(get_current_user)):
    """Lista todos os anúncios (admin only)"""
    if current_user.role != 'admin':
        raise HTTPException(status_code=403, detail="Admin only")
    
    ads = await db.advertisements.find({}, {'_id': 0}).sort('created_at', -1).to_list(100)
    return ads

@api_router.put("/admin/advertisements/{ad_id}")
async def update_advertisement(ad_id: str, ad_data: dict, current_user: User = Depends(get_current_user)):
    """Atualiza um anúncio (admin only)"""
    if current_user.role != 'admin':
        raise HTTPException(status_code=403, detail="Admin only")
    
    # Remover campos que não devem ser atualizados
    ad_data.pop('id', None)
    ad_data.pop('created_at', None)
    
    result = await db.advertisements.update_one({'id': ad_id}, {'$set': ad_data})
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Anúncio não encontrado")
    
    return {'message': 'Anúncio atualizado com sucesso'}

@api_router.delete("/admin/advertisements/{ad_id}")
async def delete_advertisement(ad_id: str, current_user: User = Depends(get_current_user)):
    """Exclui um anúncio (admin only)"""
    if current_user.role != 'admin':
        raise HTTPException(status_code=403, detail="Admin only")
    
    result = await db.advertisements.delete_one({'id': ad_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Anúncio não encontrado")
    
    return {'message': 'Anúncio excluído com sucesso'}

@api_router.post("/advertisements/seed")
async def seed_advertisements():
    """Popula com anúncios iniciais de motivação e doação"""
    
    # Verificar se já existem anúncios
    existing = await db.advertisements.count_documents({})
    if existing > 0:
        return {'message': f'{existing} anúncios já existem', 'seeded': False}
    
    default_ads = [
        {
            'id': str(uuid.uuid4()),
            'type': 'motivation',
            'title': '💪 Você é mais forte do que imagina!',
            'content': 'Cada dia é uma nova oportunidade. Não desista dos seus sonhos. A jornada pode ser difícil, mas você não está sozinho.',
            'image_url': 'https://images.unsplash.com/photo-1493612276216-ee3925520721?w=400',
            'is_active': True,
            'priority': 10,
            'created_at': datetime.now(timezone.utc)
        },
        {
            'id': str(uuid.uuid4()),
            'type': 'motivation',
            'title': '🙏 Deus está contigo',
            'content': '"Porque eu, o Senhor teu Deus, te tomo pela tua mão direita; e te digo: Não temas, eu te ajudo." - Isaías 41:13',
            'image_url': 'https://images.unsplash.com/photo-1507692049790-de58290a4334?w=400',
            'is_active': True,
            'priority': 9,
            'created_at': datetime.now(timezone.utc)
        },
        {
            'id': str(uuid.uuid4()),
            'type': 'motivation',
            'title': '✨ Acredite em você',
            'content': 'Sua história não terminou ainda. Os melhores capítulos ainda estão por vir. Continue caminhando com fé e esperança.',
            'image_url': 'https://images.unsplash.com/photo-1499209974431-9dddcece7f88?w=400',
            'is_active': True,
            'priority': 8,
            'created_at': datetime.now(timezone.utc)
        },
        {
            'id': str(uuid.uuid4()),
            'type': 'donation',
            'title': '🌍 Ajude a África - Doe Agora',
            'content': 'Milhares de famílias na África precisam de ajuda urgente. Sua doação pode salvar vidas, fornecer alimentos, água limpa e medicamentos para quem mais precisa.',
            'image_url': 'https://images.unsplash.com/photo-1509099836639-18ba1795216d?w=400',
            'link_url': 'https://www.unicef.org/appeals/africa',
            'link_text': 'Doar Agora',
            'is_active': True,
            'priority': 15,
            'created_at': datetime.now(timezone.utc)
        },
        {
            'id': str(uuid.uuid4()),
            'type': 'donation',
            'title': '❤️ Seja um anjo para alguém',
            'content': 'Com apenas €5 você pode fornecer uma refeição completa para uma criança. Cada contribuição faz a diferença.',
            'image_url': 'https://images.unsplash.com/photo-1488521787991-ed7bbaae773c?w=400',
            'link_url': 'https://donate.worldvision.org',
            'link_text': 'Contribuir',
            'is_active': True,
            'priority': 14,
            'created_at': datetime.now(timezone.utc)
        },
        {
            'id': str(uuid.uuid4()),
            'type': 'motivation',
            'title': '🌟 Nunca perca a esperança',
            'content': '"Tudo posso naquele que me fortalece." - Filipenses 4:13. Você tem dentro de si a força para superar qualquer obstáculo.',
            'image_url': 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400',
            'is_active': True,
            'priority': 7,
            'created_at': datetime.now(timezone.utc)
        }
    ]
    
    for ad in default_ads:
        await db.advertisements.insert_one(ad)
    
    return {'message': f'{len(default_ads)} anúncios criados com sucesso', 'seeded': True}

# ==================== JOB LISTINGS ENDPOINTS (RozgarLine Integration) ====================

async def fetch_rozgarline_jobs():
    """Busca vagas de emprego do site RozgarLine"""
    jobs = []
    try:
        async with aiohttp.ClientSession() as session:
            async with session.get('https://rozgarline.me/', timeout=aiohttp.ClientTimeout(total=10)) as response:
                if response.status == 200:
                    html = await response.text()
                    
                    # Parse job listings from HTML usando regex
                    # Pattern para encontrar vagas
                    job_pattern = r'<a[^>]*href="(https://rozgarline\.me/jobs/[^"]+)"[^>]*>([^<]+)</a>'
                    matches = re.findall(job_pattern, html)
                    
                    seen_titles = set()
                    for url, title in matches:
                        # Limpar título
                        clean_title = title.strip()
                        if clean_title and clean_title not in seen_titles and len(clean_title) > 5:
                            # Ignorar links genéricos
                            if 'more' not in clean_title.lower() and 'author' not in url:
                                seen_titles.add(clean_title)
                                jobs.append({
                                    'id': str(uuid.uuid4()),
                                    'title': clean_title,
                                    'url': url,
                                    'source': 'RozgarLine',
                                    'location': 'Europa',
                                    'date_posted': datetime.now(timezone.utc).strftime('%d %b %Y')
                                })
                    
    except Exception as e:
        logging.error(f"Error fetching jobs from RozgarLine: {e}")
    
    return jobs[:15]  # Limitar a 15 vagas

@api_router.get("/jobs/external")
async def get_external_jobs():
    """Retorna vagas de emprego do RozgarLine"""
    # Verificar cache
    cached = await db.job_cache.find_one({'source': 'rozgarline'})
    
    # Se cache existe e tem menos de 1 hora, usar cache
    if cached and cached.get('updated_at'):
        try:
            cached_time = cached['updated_at']
            # Garantir que é aware
            if cached_time.tzinfo is None:
                cached_time = cached_time.replace(tzinfo=timezone.utc)
            cache_age = datetime.now(timezone.utc) - cached_time
            if cache_age < timedelta(hours=1):
                return {'jobs': cached.get('jobs', []), 'cached': True}
        except Exception as e:
            logging.error(f"Cache time error: {e}")
    
    # Buscar novas vagas
    jobs = await fetch_rozgarline_jobs()
    
    # Salvar no cache
    await db.job_cache.update_one(
        {'source': 'rozgarline'},
        {'$set': {
            'source': 'rozgarline',
            'jobs': jobs,
            'updated_at': datetime.now(timezone.utc)
        }},
        upsert=True
    )
    
    return {'jobs': jobs, 'cached': False}

# ==================== MURAL DE MENSAGENS ENDPOINTS ====================

class MuralMessage(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    message: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    approved: bool = False  # Mensagens precisam de aprovação (moderação)

class MuralMessageCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=50)
    message: str = Field(..., min_length=5, max_length=500)

@api_router.get("/mural")
async def get_mural_messages(limit: int = 20):
    """Retorna as mensagens aprovadas do mural"""
    messages = await db.mural_messages.find(
        {'approved': True}, 
        {'_id': 0}
    ).sort('created_at', -1).to_list(limit)
    
    return {'messages': messages, 'total': len(messages)}

@api_router.post("/mural")
async def create_mural_message(msg_data: MuralMessageCreate):
    """Cria uma nova mensagem no mural (precisa de aprovação)"""
    message = MuralMessage(
        name=msg_data.name,
        message=msg_data.message,
        approved=True  # Por enquanto aprovamos automaticamente
    )
    
    msg_dict = message.model_dump()
    msg_dict['created_at'] = msg_dict['created_at'].isoformat()
    
    await db.mural_messages.insert_one(msg_dict)
    return {'message': 'Mensagem enviada com sucesso!', 'id': message.id}

@api_router.get("/admin/mural")
async def admin_get_mural_messages(current_user: User = Depends(get_current_user)):
    """Lista todas as mensagens do mural (admin only)"""
    if current_user.role != 'admin':
        raise HTTPException(status_code=403, detail="Admin only")
    
    messages = await db.mural_messages.find({}, {'_id': 0}).sort('created_at', -1).to_list(100)
    return messages

@api_router.put("/admin/mural/{msg_id}/approve")
async def approve_mural_message(msg_id: str, current_user: User = Depends(get_current_user)):
    """Aprova uma mensagem do mural"""
    if current_user.role != 'admin':
        raise HTTPException(status_code=403, detail="Admin only")
    
    result = await db.mural_messages.update_one({'id': msg_id}, {'$set': {'approved': True}})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Mensagem não encontrada")
    
    return {'message': 'Mensagem aprovada'}

@api_router.delete("/admin/mural/{msg_id}")
async def delete_mural_message(msg_id: str, current_user: User = Depends(get_current_user)):
    """Exclui uma mensagem do mural"""
    if current_user.role != 'admin':
        raise HTTPException(status_code=403, detail="Admin only")
    
    result = await db.mural_messages.delete_one({'id': msg_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Mensagem não encontrada")
    
    return {'message': 'Mensagem excluída'}

# ==================== JSEARCH API - BUSCA DE EMPREGOS ====================

RAPIDAPI_KEY = os.environ.get('RAPIDAPI_KEY', '')
JSEARCH_BASE_URL = "https://jsearch.p.rapidapi.com"

class JobSearchQuery(BaseModel):
    query: str = Field(default="", description="Termo de busca (ex: garçom, eletricista)")
    location: str = Field(default="France", description="Localização")
    page: int = Field(default=1, description="Página de resultados")
    num_pages: int = Field(default=1, description="Número de páginas")
    date_posted: str = Field(default="all", description="Filtro de data: all, today, 3days, week, month")
    remote_jobs_only: bool = Field(default=False, description="Apenas trabalhos remotos")
    employment_types: Optional[str] = Field(default=None, description="FULLTIME, PARTTIME, CONTRACTOR, INTERN")

@api_router.get("/jobs/search")
async def search_jobs(
    query: str = "emploi",
    location: str = "France",
    page: int = 1,
    date_posted: str = "all",
    remote_only: bool = False,
    employment_type: Optional[str] = None
):
    """Busca vagas de emprego usando JSearch API (Indeed, LinkedIn, etc.)"""
    
    if not RAPIDAPI_KEY:
        raise HTTPException(status_code=500, detail="API key não configurada")
    
    # Verificar cache primeiro (evitar muitas requisições)
    cache_key = f"jobs_{query}_{location}_{page}_{date_posted}"
    cached = await db.job_cache.find_one({'cache_key': cache_key})
    
    if cached:
        expires_at = cached.get('expires_at')
        if expires_at:
            # Converter para datetime se for string
            if isinstance(expires_at, str):
                expires_at = datetime.fromisoformat(expires_at.replace('Z', '+00:00'))
            # Garantir que ambos são timezone-aware
            if expires_at.tzinfo is None:
                expires_at = expires_at.replace(tzinfo=timezone.utc)
            
            if expires_at > datetime.now(timezone.utc):
                return {
                    'jobs': cached.get('jobs', []),
                    'total': cached.get('total', 0),
                    'page': page,
                    'cached': True
                }
    
    # Fazer requisição à API JSearch
    headers = {
        "X-RapidAPI-Key": RAPIDAPI_KEY,
        "X-RapidAPI-Host": "jsearch.p.rapidapi.com"
    }
    
    params = {
        "query": f"{query} {location}",
        "page": str(page),
        "num_pages": "1",
        "date_posted": date_posted,
        "country": "fr"
    }
    
    if remote_only:
        params["remote_jobs_only"] = "true"
    
    if employment_type:
        params["employment_types"] = employment_type
    
    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(
                f"{JSEARCH_BASE_URL}/search",
                headers=headers,
                params=params,
                timeout=aiohttp.ClientTimeout(total=30)
            ) as response:
                if response.status != 200:
                    error_text = await response.text()
                    logging.error(f"JSearch API error: {response.status} - {error_text}")
                    raise HTTPException(status_code=response.status, detail=f"Erro na API: {error_text}")
                
                data = await response.json()
                
                # Processar resultados
                jobs = []
                for job in data.get('data', []):
                    jobs.append({
                        'id': job.get('job_id', str(uuid.uuid4())),
                        'title': job.get('job_title', 'Vaga sem título'),
                        'company': job.get('employer_name', 'Empresa não informada'),
                        'company_logo': job.get('employer_logo'),
                        'location': job.get('job_city', job.get('job_country', 'Não informado')),
                        'description': job.get('job_description', '')[:500] + '...' if job.get('job_description') else '',
                        'employment_type': job.get('job_employment_type', 'Não informado'),
                        'date_posted': job.get('job_posted_at_datetime_utc', ''),
                        'url': job.get('job_apply_link', job.get('job_google_link', '')),
                        'source': job.get('job_publisher', 'JSearch'),
                        'salary_min': job.get('job_min_salary'),
                        'salary_max': job.get('job_max_salary'),
                        'salary_currency': job.get('job_salary_currency'),
                        'is_remote': job.get('job_is_remote', False),
                        'qualifications': job.get('job_required_skills', []),
                        'benefits': job.get('job_benefits', [])
                    })
                
                total = data.get('total', len(jobs))
                
                # Salvar no cache (expira em 1 hora)
                await db.job_cache.update_one(
                    {'cache_key': cache_key},
                    {
                        '$set': {
                            'cache_key': cache_key,
                            'jobs': jobs,
                            'total': total,
                            'expires_at': datetime.now(timezone.utc) + timedelta(hours=1),
                            'created_at': datetime.now(timezone.utc).isoformat()
                        }
                    },
                    upsert=True
                )
                
                return {
                    'jobs': jobs,
                    'total': total,
                    'page': page,
                    'cached': False
                }
                
    except aiohttp.ClientError as e:
        logging.error(f"JSearch API connection error: {e}")
        raise HTTPException(status_code=503, detail=f"Erro de conexão com a API: {str(e)}")
    except Exception as e:
        logging.error(f"JSearch API error: {e}")
        raise HTTPException(status_code=500, detail=f"Erro interno: {str(e)}")

@api_router.get("/jobs/details/{job_id}")
async def get_job_details(job_id: str):
    """Obtém detalhes de uma vaga específica"""
    
    if not RAPIDAPI_KEY:
        raise HTTPException(status_code=500, detail="API key não configurada")
    
    headers = {
        "X-RapidAPI-Key": RAPIDAPI_KEY,
        "X-RapidAPI-Host": "jsearch.p.rapidapi.com"
    }
    
    params = {"job_id": job_id}
    
    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(
                f"{JSEARCH_BASE_URL}/job-details",
                headers=headers,
                params=params,
                timeout=aiohttp.ClientTimeout(total=30)
            ) as response:
                if response.status != 200:
                    raise HTTPException(status_code=response.status, detail="Erro ao buscar detalhes")
                
                data = await response.json()
                
                if not data.get('data'):
                    raise HTTPException(status_code=404, detail="Vaga não encontrada")
                
                job = data['data'][0]
                
                return {
                    'id': job.get('job_id'),
                    'title': job.get('job_title'),
                    'company': job.get('employer_name'),
                    'company_logo': job.get('employer_logo'),
                    'company_website': job.get('employer_website'),
                    'location': f"{job.get('job_city', '')}, {job.get('job_country', '')}",
                    'description': job.get('job_description', ''),
                    'employment_type': job.get('job_employment_type'),
                    'date_posted': job.get('job_posted_at_datetime_utc'),
                    'url': job.get('job_apply_link', job.get('job_google_link', '')),
                    'source': job.get('job_publisher'),
                    'salary_min': job.get('job_min_salary'),
                    'salary_max': job.get('job_max_salary'),
                    'salary_currency': job.get('job_salary_currency'),
                    'is_remote': job.get('job_is_remote', False),
                    'qualifications': job.get('job_required_skills', []),
                    'benefits': job.get('job_benefits', []),
                    'experience_required': job.get('job_required_experience', {}),
                    'education_required': job.get('job_required_education', {})
                }
                
    except aiohttp.ClientError as e:
        raise HTTPException(status_code=503, detail=f"Erro de conexão: {str(e)}")

@api_router.get("/jobs/suggested")
async def get_suggested_jobs(category: str = "all"):
    """Retorna vagas sugeridas por categoria"""
    
    # Mapeamento de categorias para termos de busca
    category_queries = {
        'bricolage': 'electrician plumber handyman France',
        'cleaning': 'cleaning housekeeping France',
        'transport': 'driver delivery chauffeur France',
        'food': 'restaurant cook chef waiter France',
        'care': 'caregiver nurse aide soignant France',
        'education': 'teacher tutor professor France',
        'tech': 'developer IT technician France',
        'childcare': 'babysitter nanny childcare France',
        'garden': 'gardener landscaper France',
        'moving': 'mover warehouse logistics France',
        'all': 'jobs France'
    }
    
    query = category_queries.get(category, category_queries['all'])
    
    return await search_jobs(query=query, location="France", page=1, date_posted="week")

@api_router.get("/sidebar-content")
async def get_sidebar_content():
    """Retorna todo o conteúdo da sidebar: anúncios + vagas de emprego"""
    
    # Buscar anúncios ativos
    ads = await db.advertisements.find({'is_active': True}, {'_id': 0}).sort('priority', -1).to_list(10)
    
    # Buscar vagas de emprego (do cache ou externo)
    jobs_data = await get_external_jobs()
    jobs = jobs_data.get('jobs', [])
    
    # Intercalar conteúdo: motivação, vaga, doação, vaga, motivação...
    sidebar_items = []
    
    motivation_ads = [a for a in ads if a.get('type') == 'motivation']
    donation_ads = [a for a in ads if a.get('type') == 'donation']
    
    # Adicionar 2 motivações primeiro
    for ad in motivation_ads[:2]:
        sidebar_items.append({**ad, 'item_type': 'advertisement'})
    
    # Adicionar 3 vagas de emprego
    for job in jobs[:3]:
        sidebar_items.append({
            'id': job.get('id', ''),
            'item_type': 'job',
            'type': 'job',
            'title': f"💼 {job.get('title', 'Vaga')}",
            'content': f"📍 {job.get('location', 'Europa')} • {job.get('date_posted', 'Recente')}",
            'link_url': job.get('url', ''),
            'link_text': 'Ver Vaga',
            'image_url': 'https://images.unsplash.com/photo-1486312338219-ce68d2c6f44d?w=400',
            'source': job.get('source', 'JSearch')
        })
    
    # Adicionar doações
    for ad in donation_ads[:2]:
        sidebar_items.append({**ad, 'item_type': 'advertisement'})
    
    # Adicionar mais vagas
    for job in jobs[3:6]:
        sidebar_items.append({
            'id': job.get('id', ''),
            'item_type': 'job',
            'type': 'job',
            'title': f"💼 {job.get('title', 'Vaga')}",
            'content': f"📍 {job.get('location', 'Europa')} • {job.get('date_posted', 'Recente')}",
            'link_url': job.get('url', ''),
            'link_text': 'Ver Vaga',
            'image_url': 'https://images.unsplash.com/photo-1521791136064-7986c2920216?w=400',
            'source': job.get('source', 'JSearch')
        })
    
    # Adicionar mais motivações
    for ad in motivation_ads[2:]:
        sidebar_items.append({**ad, 'item_type': 'advertisement'})
    
    # Adicionar resto das vagas
    for job in jobs[6:]:
        sidebar_items.append({
            'id': job.get('id', ''),
            'item_type': 'job',
            'type': 'job',
            'title': f"💼 {job.get('title', 'Vaga')}",
            'content': f"📍 {job.get('location', 'Europa')} • {job.get('date_posted', 'Recente')}",
            'link_url': job.get('url', ''),
            'link_text': 'Candidatar',
            'image_url': 'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=400',
            'source': job.get('source', 'JSearch')
        })
    
    return {
        'items': sidebar_items,
        'total_ads': len(ads),
        'total_jobs': len(jobs)
    }

# ==================== INTEGRAÇÃO: VAGAS NO MAPA E FEED ====================

@api_router.post("/jobs/sync-to-map")
async def sync_jobs_to_map(current_user: User = Depends(get_current_user)):
    """Sincroniza vagas de emprego com o mapa de oportunidades"""
    
    # Buscar vagas do cache
    jobs_data = await search_jobs(query="emploi", location="France", page=1)
    jobs = jobs_data.get('jobs', [])
    
    synced_count = 0
    for job in jobs[:20]:  # Limitar a 20 vagas
        # Verificar se já existe
        existing = await db.job_map_locations.find_one({'job_id': job.get('id')})
        if existing:
            continue
        
        # Extrair cidade da localização
        location_str = job.get('location') or 'Paris'
        
        # Coordenadas aproximadas para principais cidades da França
        city_coords = {
            'paris': {'lat': 48.8566, 'lng': 2.3522},
            'lyon': {'lat': 45.7640, 'lng': 4.8357},
            'marseille': {'lat': 43.2965, 'lng': 5.3698},
            'toulouse': {'lat': 43.6047, 'lng': 1.4442},
            'nice': {'lat': 43.7102, 'lng': 7.2620},
            'nantes': {'lat': 47.2184, 'lng': -1.5536},
            'bordeaux': {'lat': 44.8378, 'lng': -0.5792},
            'lille': {'lat': 50.6292, 'lng': 3.0573},
            'strasbourg': {'lat': 48.5734, 'lng': 7.7521},
            'rennes': {'lat': 48.1173, 'lng': -1.6778}
        }
        
        # Encontrar coordenadas
        coords = city_coords.get('paris')  # Default para Paris
        for city, coord in city_coords.items():
            if city in location_str.lower():
                coords = coord
                break
        
        # Adicionar pequena variação para não sobrepor marcadores
        lat_offset = random.uniform(-0.02, 0.02)
        lng_offset = random.uniform(-0.02, 0.02)
        
        job_location = {
            'id': str(uuid.uuid4()),
            'job_id': job.get('id'),
            'name': job.get('title', 'Vaga de Emprego'),
            'company': job.get('company', 'Empresa'),
            'address': location_str,
            'category': 'work',
            'lat': coords['lat'] + lat_offset,
            'lng': coords['lng'] + lng_offset,
            'url': job.get('url', ''),
            'salary_min': job.get('salary_min'),
            'salary_max': job.get('salary_max'),
            'employment_type': job.get('employment_type'),
            'is_remote': job.get('is_remote', False),
            'source': job.get('source', 'JSearch'),
            'created_at': datetime.now(timezone.utc).isoformat()
        }
        
        await db.job_map_locations.insert_one(job_location)
        synced_count += 1
    
    return {'message': f'{synced_count} vagas sincronizadas com o mapa', 'count': synced_count}

@api_router.get("/jobs/map-locations")
async def get_job_map_locations(
    lat: Optional[float] = None,
    lng: Optional[float] = None,
    radius: float = 50.0
):
    """Retorna vagas de emprego para exibir no mapa"""
    
    # Buscar vagas salvas no mapa
    job_locations = await db.job_map_locations.find({}, {'_id': 0}).to_list(100)
    
    # Se coordenadas fornecidas, calcular distância
    if lat is not None and lng is not None:
        for job in job_locations:
            if job.get('lat') and job.get('lng'):
                job['distance'] = round(calculate_distance(lat, lng, job['lat'], job['lng']), 2)
        
        # Filtrar por raio
        job_locations = [j for j in job_locations if j.get('distance', 0) <= radius]
        
        # Ordenar por distância
        job_locations.sort(key=lambda x: x.get('distance', float('inf')))
    
    return {'locations': job_locations, 'total': len(job_locations)}

@api_router.post("/jobs/auto-post")
async def auto_post_jobs(limit: int = 5):
    """Cria posts automáticos de vagas de emprego no feed"""
    
    # Buscar vagas do cache
    jobs_data = await search_jobs(query="emploi", location="France", page=1)
    jobs = jobs_data.get('jobs', [])
    
    posted_count = 0
    for job in jobs[:limit]:
        # Verificar se já foi postado
        existing = await db.posts.find_one({'job_id': job.get('id')})
        if existing:
            continue
        
        # Criar post da vaga
        post_dict = {
            'id': str(uuid.uuid4()),
            'user_id': 'system',
            'type': 'job',
            'category': 'work',
            'categories': ['work'],
            'title': f"💼 {job.get('title', 'Vaga de Emprego')}",
            'description': f"""🏢 **{job.get('company', 'Empresa')}**
📍 {job.get('location', 'França')}
{f"💰 {job.get('salary_min')}-{job.get('salary_max')} {job.get('salary_currency', 'EUR')}" if job.get('salary_min') else ""}
{"🏠 Trabalho Remoto" if job.get('is_remote') else ""}

{job.get('description', '')[:300]}...

🔗 Candidate-se: {job.get('url', '')}""",
            'location': None,
            'images': [job.get('company_logo')] if job.get('company_logo') else [],
            'job_id': job.get('id'),
            'job_url': job.get('url'),
            'job_company': job.get('company'),
            'job_salary_min': job.get('salary_min'),
            'job_salary_max': job.get('salary_max'),
            'is_job_post': True,
            'created_at': datetime.now(timezone.utc).isoformat()
        }
        
        await db.posts.insert_one(post_dict)
        posted_count += 1
    
    return {'message': f'{posted_count} vagas postadas no feed', 'count': posted_count}

@api_router.delete("/jobs/cache")
async def clear_jobs_cache():
    """Limpa o cache de vagas para forçar atualização"""
    result = await db.job_cache.delete_many({})
    result2 = await db.job_map_locations.delete_many({})
    return {'message': f'Cache limpo: {result.deleted_count} itens removidos', 'map_locations_removed': result2.deleted_count}

# ==================== PREFERÊNCIAS DE EMPREGO DO USUÁRIO ====================

class JobPreferences(BaseModel):
    search_query: str
    search_location: str = "França"
    availability: Optional[str] = None
    experience: Optional[str] = None

@api_router.post("/user/job-preferences")
async def save_job_preferences(prefs: JobPreferences, current_user: User = Depends(get_current_user)):
    """Salva as preferências de emprego do usuário para receber vagas personalizadas"""
    
    job_prefs = {
        'user_id': current_user.id,
        'search_query': prefs.search_query,
        'search_location': prefs.search_location,
        'availability': prefs.availability,
        'experience': prefs.experience,
        'is_active': True,
        'created_at': datetime.now(timezone.utc).isoformat(),
        'updated_at': datetime.now(timezone.utc).isoformat()
    }
    
    # Atualizar ou criar preferências
    await db.job_preferences.update_one(
        {'user_id': current_user.id},
        {'$set': job_prefs},
        upsert=True
    )
    
    return {'message': 'Preferências salvas! Você receberá vagas personalizadas.', 'preferences': job_prefs}

@api_router.get("/user/job-preferences")
async def get_job_preferences(current_user: User = Depends(get_current_user)):
    """Retorna as preferências de emprego do usuário"""
    prefs = await db.job_preferences.find_one({'user_id': current_user.id}, {'_id': 0})
    return prefs or {'is_active': False}

@api_router.delete("/user/job-preferences")
async def delete_job_preferences(current_user: User = Depends(get_current_user)):
    """Desativa as preferências de emprego do usuário"""
    await db.job_preferences.update_one(
        {'user_id': current_user.id},
        {'$set': {'is_active': False, 'updated_at': datetime.now(timezone.utc).isoformat()}}
    )
    return {'message': 'Alertas de vagas desativados'}

@api_router.get("/user/personalized-jobs")
async def get_personalized_jobs(current_user: User = Depends(get_current_user)):
    """Retorna vagas personalizadas baseadas nas preferências do usuário"""
    
    # Buscar preferências do usuário
    prefs = await db.job_preferences.find_one({'user_id': current_user.id, 'is_active': True})
    
    if not prefs:
        return {'jobs': [], 'message': 'Nenhuma preferência de emprego configurada'}
    
    # Mapeamento português → francês
    translations = {
        'garçom': 'serveur', 'garcom': 'serveur', 'cozinheiro': 'cuisinier',
        'limpeza': 'nettoyage', 'motorista': 'chauffeur', 'construção': 'construction',
        'vendedor': 'vendeur', 'caixa': 'caissier', 'entregador': 'livreur',
        'pedreiro': 'maçon', 'eletricista': 'électricien', 'jardineiro': 'jardinier',
        'babá': 'nounou', 'cuidador': 'aide-soignant', 'segurança': 'agent de sécurité',
        'recepcionista': 'réceptionniste', 'auxiliar': 'assistant', 'operador': 'opérateur',
        'mecânico': 'mécanicien', 'padeiro': 'boulanger', 'carpinteiro': 'charpentier',
        'soldador': 'soudeur', 'técnico': 'technicien', 'enfermeiro': 'infirmier',
        'secretária': 'secrétaire', 'contador': 'comptable'
    }
    
    # Traduzir termo de busca
    query = prefs.get('search_query', '').lower()
    translated_query = translations.get(query, query)
    location = prefs.get('search_location', 'France')
    
    # Buscar vagas
    jobs_data = await search_jobs(query=translated_query, location=location, page=1)
    jobs = jobs_data.get('jobs', [])
    
    # Formatar vagas para o feed
    personalized_jobs = []
    for job in jobs[:10]:  # Limitar a 10 vagas
        personalized_jobs.append({
            'id': job.get('id', str(uuid.uuid4())),
            'type': 'personalized_job',
            'title': job.get('title', 'Vaga de Emprego'),
            'company': job.get('company', 'Empresa'),
            'location': job.get('location', location),
            'url': job.get('url', ''),
            'company_logo': job.get('company_logo'),
            'salary_min': job.get('salary_min'),
            'salary_max': job.get('salary_max'),
            'salary_currency': job.get('salary_currency', 'EUR'),
            'is_remote': job.get('is_remote', False),
            'date_posted': job.get('date_posted', 'Recente'),
            'source': job.get('source', 'JSearch'),
            'search_query': prefs.get('search_query'),
            'is_personalized': True
        })
    
    return {
        'jobs': personalized_jobs,
        'total': len(personalized_jobs),
        'preferences': {
            'query': prefs.get('search_query'),
            'location': prefs.get('search_location')
        }
    }

# ==================== HOUSING ENDPOINTS ====================

@api_router.get("/housing")
async def get_housing_listings(
    type: Optional[str] = None,
    city: Optional[str] = None,
    current_user: User = Depends(get_current_user)
):
    """Lista anúncios de hospedagem com filtros opcionais"""
    query = {'listing_status': 'active'}
    
    if type and type != 'all':
        query['listing_type'] = type
    
    if city:
        query['city'] = {'$regex': city, '$options': 'i'}
    
    listings = await db.housing_listings.find(query, {'_id': 0}).sort('created_at', -1).to_list(100)
    
    # Adicionar info do usuário a cada listing
    for listing in listings:
        user = await db.users.find_one({'id': listing['user_id']}, {'_id': 0, 'password': 0})
        if user:
            listing['user'] = {
                'id': user.get('id'),
                'name': user.get('name'),
                'verified': user.get('verified', False),
                'rating': user.get('rating', 4.5),
                'reviews_count': user.get('reviews_count', 0)
            }
    
    return listings

@api_router.post("/housing")
async def create_housing_listing(
    listing_data: HousingListingCreate,
    current_user: User = Depends(get_current_user)
):
    """Cria um novo anúncio de hospedagem"""
    listing = HousingListing(
        user_id=current_user.id,
        listing_type=listing_data.listing_type,
        title=listing_data.title,
        description=listing_data.description,
        city=listing_data.city,
        address=listing_data.address,
        accommodation_type=listing_data.accommodation_type,
        duration=listing_data.duration,
        max_guests=listing_data.max_guests,
        amenities=listing_data.amenities,
        pets_allowed=listing_data.pets_allowed,
        available_from=listing_data.available_from,
        available_until=listing_data.available_until,
        exchange_services=listing_data.exchange_services,
        photos=listing_data.photos
    )
    
    await db.housing_listings.insert_one(listing.model_dump())
    
    return {'message': 'Anúncio criado com sucesso', 'id': listing.id}

@api_router.get("/housing/{listing_id}")
async def get_housing_listing(
    listing_id: str,
    current_user: User = Depends(get_current_user)
):
    """Retorna detalhes de um anúncio específico"""
    listing = await db.housing_listings.find_one({'id': listing_id}, {'_id': 0})
    
    if not listing:
        raise HTTPException(status_code=404, detail="Anúncio não encontrado")
    
    # Adicionar info do usuário
    user = await db.users.find_one({'id': listing['user_id']}, {'_id': 0, 'password': 0})
    if user:
        listing['user'] = {
            'id': user.get('id'),
            'name': user.get('name'),
            'email': user.get('email'),
            'phone': user.get('phone'),
            'verified': user.get('verified', False),
            'rating': user.get('rating', 4.5),
            'reviews_count': user.get('reviews_count', 0)
        }
    
    return listing

@api_router.put("/housing/{listing_id}")
async def update_housing_listing(
    listing_id: str,
    listing_data: HousingListingCreate,
    current_user: User = Depends(get_current_user)
):
    """Atualiza um anúncio de hospedagem"""
    listing = await db.housing_listings.find_one({'id': listing_id})
    
    if not listing:
        raise HTTPException(status_code=404, detail="Anúncio não encontrado")
    
    if listing['user_id'] != current_user.id and current_user.role != 'admin':
        raise HTTPException(status_code=403, detail="Sem permissão para editar este anúncio")
    
    update_data = listing_data.model_dump()
    update_data['updated_at'] = datetime.now(timezone.utc).isoformat()
    
    await db.housing_listings.update_one(
        {'id': listing_id},
        {'$set': update_data}
    )
    
    return {'message': 'Anúncio atualizado com sucesso'}

@api_router.delete("/housing/{listing_id}")
async def delete_housing_listing(
    listing_id: str,
    current_user: User = Depends(get_current_user)
):
    """Remove um anúncio de hospedagem"""
    listing = await db.housing_listings.find_one({'id': listing_id})
    
    if not listing:
        raise HTTPException(status_code=404, detail="Anúncio não encontrado")
    
    if listing['user_id'] != current_user.id and current_user.role != 'admin':
        raise HTTPException(status_code=403, detail="Sem permissão para remover este anúncio")
    
    await db.housing_listings.delete_one({'id': listing_id})
    
    return {'message': 'Anúncio removido com sucesso'}

@api_router.put("/housing/{listing_id}/status")
async def update_housing_status(
    listing_id: str,
    new_status: str,
    current_user: User = Depends(get_current_user)
):
    """Atualiza o status de um anúncio (active, matched, closed)"""
    listing = await db.housing_listings.find_one({'id': listing_id})
    
    if not listing:
        raise HTTPException(status_code=404, detail="Anúncio não encontrado")
    
    if listing['user_id'] != current_user.id and current_user.role != 'admin':
        raise HTTPException(status_code=403, detail="Sem permissão para alterar este anúncio")
    
    await db.housing_listings.update_one(
        {'id': listing_id},
        {'$set': {'listing_status': new_status, 'updated_at': datetime.now(timezone.utc).isoformat()}}
    )
    
    return {'message': f'Status atualizado para {new_status}'}


# ==================== SUBSCRIPTION / PIX ====================
from pix_generator import build_pix_brcode, generate_pix_qr_base64

# Configurações do plano (pode mover para env vars depois)
SUB_AMOUNT = float(os.environ.get('SUB_AMOUNT', '35.90'))
SUB_TRIAL_DAYS = int(os.environ.get('SUB_TRIAL_DAYS', '3'))
PIX_KEY = os.environ.get('PIX_KEY', 'jatairegiao@suporte.com')
PIX_MERCHANT_NAME = os.environ.get('PIX_MERCHANT_NAME', 'JATAI REGIAO TRABALHO')
PIX_MERCHANT_CITY = os.environ.get('PIX_MERCHANT_CITY', 'SAO PAULO')


class SubscriptionStartResponse(BaseModel):
    subscription_id: str
    status: str
    trial_ends_at: str
    amount: float
    brcode: str
    qr_code_base64: str
    pix_key: str


@api_router.get("/subscription/status")
async def subscription_status(current_user: User = Depends(get_current_user)):
    sub = await db.subscriptions.find_one({'user_id': current_user.id}, {'_id': 0})
    if not sub:
        return {'active': False, 'has_subscription': False}
    now = datetime.now(timezone.utc)
    trial_ends = datetime.fromisoformat(sub['trial_ends_at']) if isinstance(sub.get('trial_ends_at'), str) else sub.get('trial_ends_at')
    in_trial = trial_ends and trial_ends > now
    return {
        'has_subscription': True,
        'active': sub.get('status') == 'active' or in_trial,
        'status': sub.get('status'),
        'in_trial': bool(in_trial),
        'trial_ends_at': sub.get('trial_ends_at'),
        'amount': sub.get('amount', SUB_AMOUNT),
        'paid_at': sub.get('paid_at'),
    }


@api_router.post("/subscription/start", response_model=SubscriptionStartResponse)
async def subscription_start(current_user: User = Depends(get_current_user)):
    """Inicia trial de 3 dias e gera QR Code PIX para cobrança recorrente."""
    now = datetime.now(timezone.utc)
    trial_ends = now + timedelta(days=SUB_TRIAL_DAYS)

    sub = await db.subscriptions.find_one({'user_id': current_user.id}, {'_id': 0})
    if sub:
        sub_id = sub['id']
        trial_ends_iso = sub.get('trial_ends_at') or trial_ends.isoformat()
    else:
        sub_id = str(uuid.uuid4())
        trial_ends_iso = trial_ends.isoformat()
        await db.subscriptions.insert_one({
            'id': sub_id,
            'user_id': current_user.id,
            'status': 'trial',
            'amount': SUB_AMOUNT,
            'trial_ends_at': trial_ends_iso,
            'created_at': now.isoformat(),
            'paid_at': None,
        })

    # txid curto (sem hifens)
    txid = sub_id.replace('-', '')[:25]
    brcode = build_pix_brcode(
        pix_key=PIX_KEY,
        merchant_name=PIX_MERCHANT_NAME,
        merchant_city=PIX_MERCHANT_CITY,
        amount=SUB_AMOUNT,
        txid=txid,
        description=f"Assinatura {current_user.name[:20]}",
    )
    qr_base64 = generate_pix_qr_base64(brcode)

    return SubscriptionStartResponse(
        subscription_id=sub_id,
        status='trial',
        trial_ends_at=trial_ends_iso,
        amount=SUB_AMOUNT,
        brcode=brcode,
        qr_code_base64=qr_base64,
        pix_key=PIX_KEY,
    )


class SubscriptionConfirmRequest(BaseModel):
    transaction_id: Optional[str] = None
    proof_message: Optional[str] = None


@api_router.post("/subscription/confirm-payment")
async def subscription_confirm(payload: SubscriptionConfirmRequest, current_user: User = Depends(get_current_user)):
    """Usuário declara que pagou. Status fica 'pending_verification' até admin aprovar."""
    sub = await db.subscriptions.find_one({'user_id': current_user.id}, {'_id': 0})
    if not sub:
        raise HTTPException(status_code=404, detail="Subscription not found")
    await db.subscriptions.update_one(
        {'id': sub['id']},
        {'$set': {
            'status': 'pending_verification',
            'declared_at': datetime.now(timezone.utc).isoformat(),
            'transaction_id': payload.transaction_id,
            'proof_message': payload.proof_message,
        }}
    )
    return {'ok': True, 'status': 'pending_verification'}


@api_router.get("/admin/subscriptions")
async def admin_list_subscriptions(current_user: User = Depends(get_current_user)):
    if current_user.role != 'admin':
        raise HTTPException(status_code=403, detail="Admin only")
    subs = await db.subscriptions.find({}, {'_id': 0}).to_list(1000)
    # Enrich with user data
    user_ids = list({s['user_id'] for s in subs})
    users = {u['id']: u async for u in db.users.find({'id': {'$in': user_ids}}, {'_id': 0, 'password': 0})}
    for s in subs:
        s['user'] = users.get(s['user_id'])
    return subs


@api_router.post("/admin/subscriptions/{sub_id}/activate")
async def admin_activate_subscription(sub_id: str, current_user: User = Depends(get_current_user)):
    if current_user.role != 'admin':
        raise HTTPException(status_code=403, detail="Admin only")
    now = datetime.now(timezone.utc)
    result = await db.subscriptions.update_one(
        {'id': sub_id},
        {'$set': {
            'status': 'active',
            'paid_at': now.isoformat(),
            'activated_by': current_user.id,
        }}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Subscription not found")
    return {'ok': True}


# ==================== PIX charges (service payments between users) ====================
class PixChargeRequest(BaseModel):
    amount: float
    to_user_id: str
    description: Optional[str] = ""


@api_router.post("/payments/pix-charge")
async def create_pix_charge(payload: PixChargeRequest, current_user: User = Depends(get_current_user)):
    """Gera um QR Code PIX para cobrar outro usuário (não é assinatura)."""
    if payload.amount <= 0 or payload.amount > 50000:
        raise HTTPException(status_code=400, detail="Invalid amount")
    charge_id = str(uuid.uuid4())
    txid = charge_id.replace('-', '')[:25]
    brcode = build_pix_brcode(
        pix_key=PIX_KEY,
        merchant_name=PIX_MERCHANT_NAME,
        merchant_city=PIX_MERCHANT_CITY,
        amount=payload.amount,
        txid=txid,
        description=(payload.description or "Servico")[:25],
    )
    qr_base64 = generate_pix_qr_base64(brcode)
    await db.pix_charges.insert_one({
        'id': charge_id,
        'from_user_id': current_user.id,
        'to_user_id': payload.to_user_id,
        'amount': payload.amount,
        'description': payload.description,
        'status': 'pending',
        'brcode': brcode,
        'created_at': datetime.now(timezone.utc).isoformat(),
    })
    return {
        'charge_id': charge_id,
        'amount': payload.amount,
        'brcode': brcode,
        'qr_code_base64': qr_base64,
        'pix_key': PIX_KEY,
    }


app.include_router(api_router)

# Health check na raiz para o Render
@app.get("/")
async def health_check():
    return {
        "status": "ok",
        "message": "Watizat API is running",
        "api_endpoint": "/api"
    }

# Health check alternativo
@app.get("/health")
async def health():
    try:
        # Testa conexão MongoDB
        await db.command('ping')
        return {"status": "healthy", "database": "connected"}
    except Exception as e:
        return {"status": "unhealthy", "database": "disconnected", "error": str(e)}

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()

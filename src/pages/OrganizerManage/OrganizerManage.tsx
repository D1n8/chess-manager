import { useEffect, useState, FormEvent } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../../supabaseClient'
import type { Participant, Match, AppUser } from '../../types'
import './OrganizerManage.css'

export default function OrganizerManage() {
    const { id } = useParams()
    const [participants, setParticipants] = useState<Participant[]>([])
    const [matches, setMatches] = useState<Match[]>([])
    const [tab, setTab] = useState<'participants' | 'matches'>('participants')

    const [showAddModal, setShowAddModal] = useState(false)
    const [searchQuery, setSearchQuery] = useState('')
    const [foundPlayers, setFoundPlayers] = useState<AppUser[]>([])

    const [newPlayer, setNewPlayer] = useState({ full_name: '', email: '', age: '', rating: '' })
    const [generatedCredentials, setGeneratedCredentials] = useState<{ email: string, password: string } | null>(null)

    const fetchData = async () => {
        const { data: pData } = await supabase
            .from('participants')
            .select('*, app_users(full_name, rating)')
            .eq('tournament_id', id)

        const { data: mData } = await supabase
            .from('matches')
            .select('*')
            .eq('tournament_id', id)

        setParticipants(pData || [])
        setMatches(mData || [])
    }

    useEffect(() => { if (id) fetchData() }, [id])

    const confirmPlayer = async (pId: string) => {
        await supabase.from('participants').update({ status: 'confirmed' }).eq('id', pId)
        fetchData()
    }

    const removePlayer = async (pId: string) => {
        if (window.confirm('Вы уверены, что хотите удалить участника?')) {
            await supabase.from('participants').delete().eq('id', pId)
            fetchData()
        }
    }

    const handleSearch = async () => {
        const { data } = await supabase
            .from('app_users')
            .select('*')
            .eq('role', 'player')
            .ilike('full_name', `%${searchQuery}%`)

        setFoundPlayers(data || [])
    }

    const addExistingPlayer = async (playerId: string) => {
        const { error } = await supabase.from('participants').insert([{
            tournament_id: id,
            player_id: playerId,
            status: 'confirmed'
        }])
        if (error) alert('Игрок уже в турнире')
        else {
            fetchData()
            setShowAddModal(false)
            setSearchQuery('')
            setFoundPlayers([])
        }
    }

    const generatePassword = () => {
        return Math.random().toString(36).slice(-8)
    }

    const handleCreateNewPlayer = async (e: FormEvent) => {
        e.preventDefault()
        const password = generatePassword()

        const { data: user, error: userError } = await supabase.from('app_users').insert([{
            email: newPlayer.email,
            password: password,
            role: 'player',
            full_name: newPlayer.full_name,
            age: parseInt(newPlayer.age),
            rating: parseInt(newPlayer.rating)
        }]).select().single()

        if (userError) {
            alert('Ошибка: возможно email уже занят')
            return
        }

        if (user) {
            await supabase.from('participants').insert([{
                tournament_id: id,
                player_id: user.id,
                status: 'confirmed'
            }])

            // Показываем пароль организатору
            setGeneratedCredentials({ email: newPlayer.email, password: password })

            // Очищаем форму
            setNewPlayer({ full_name: '', email: '', age: '', rating: '' })
            fetchData()
        }
    }

    const updateResult = async (mId: string, result: string) => {
        await supabase.from('matches').update({ result }).eq('id', mId)
        fetchData()
    }

    const generateRound = async () => {
        const confirmedPlayers = participants.filter(p => p.status === 'confirmed')
        if (confirmedPlayers.length < 2) {
            alert('Недостаточно подтвержденных участников')
            return
        }

        await supabase.from('matches').insert([{
            tournament_id: id,
            round_number: 1,
            table_number: 1,
            player_white: confirmedPlayers[0].app_users?.full_name || 'Игрок 1',
            player_black: confirmedPlayers[1].app_users?.full_name || 'Игрок 2'
        }])
        fetchData()
    }

    const closeModal = () => {
        setShowAddModal(false)
        setGeneratedCredentials(null)
        setSearchQuery('')
        setFoundPlayers([])
    }

    return (
        <div className="container">
            <div className="tabs">
                <button className={`tab-btn ${tab === 'participants' ? 'active' : ''}`} onClick={() => setTab('participants')}>Участники</button>
                <button className={`tab-btn ${tab === 'matches' ? 'active' : ''}`} onClick={() => setTab('matches')}>Жеребьевка</button>
            </div>

            {tab === 'participants' && (
                <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <h2 style={{ color: '#660000' }}>Управление участниками</h2>
                        <button className="btn-primary" onClick={() => setShowAddModal(true)}>+ Добавить участника</button>
                    </div>

                    <table>
                        <thead><tr><th>ФИО</th><th>Рейтинг</th><th>Статус</th><th>Действия</th></tr></thead>
                        <tbody>
                            {participants.map(p => (
                                <tr key={p.id}>
                                    <td>{p.app_users?.full_name}</td>
                                    <td>{p.app_users?.rating}</td>
                                    <td><span className={`badge ${p.status === 'pending' ? 'bg-pending' : 'bg-confirmed'}`}>
                                        {p.status === 'pending' ? 'Ожидает' : 'Принят'}
                                    </span></td>
                                    <td className="actions-cell">
                                        {p.status === 'pending' && <button className="btn-success" onClick={() => confirmPlayer(p.id)}>Принять</button>}
                                        <button className="btn-danger" onClick={() => removePlayer(p.id)}>
                                            {p.status === 'pending' ? 'Отклонить' : 'Удалить'}
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {tab === 'matches' && (
                <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <h2 style={{ color: '#660000' }}>Ввод результатов</h2>
                        <button className="btn-primary" onClick={generateRound}>Сгенерировать тур</button>
                    </div>
                    <table>
                        <thead><tr><th>Тур</th><th>Стол</th><th>Белые</th><th>Черные</th><th>Счет</th></tr></thead>
                        <tbody>
                            {matches.map(m => (
                                <tr key={m.id}>
                                    <td>{m.round_number}</td><td>{m.table_number}</td>
                                    <td>{m.player_white}</td><td>{m.player_black}</td>
                                    <td>
                                        <select value={m.result || ''} onChange={(e) => updateResult(m.id, e.target.value)}>
                                            <option value="">--</option>
                                            <option value="1-0">1-0</option>
                                            <option value="0-1">0-1</option>
                                            <option value="0.5-0.5">Ничья</option>
                                        </select>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {showAddModal && (
                <div className="modal-overlay">
                    <div className="modal-content">
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
                            <h3 style={{ color: '#660000' }}>Добавить участника</h3>
                            <button onClick={closeModal} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer' }}>×</button>
                        </div>

                        {generatedCredentials ? (
                            <div style={{ backgroundColor: '#e6ffe6', padding: '15px', borderRadius: '4px', marginBottom: '20px', border: '1px solid #2e8b57' }}>
                                <h4 style={{ color: '#2e8b57', marginBottom: '10px' }}>Игрок успешно зарегистрирован!</h4>
                                <p>Передайте эти данные игроку для входа:</p>
                                <p><strong>Логин:</strong> {generatedCredentials.email}</p>
                                <p><strong>Пароль:</strong> {generatedCredentials.password}</p>
                                <button className="btn-primary" style={{ marginTop: '15px', width: '100%' }} onClick={() => setGeneratedCredentials(null)}>Зарегистрировать еще одного</button>
                            </div>
                        ) : (
                            <>
                                <div className="search-box">
                                    <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Поиск по ФИО..." style={{ marginBottom: 0 }} />
                                    <button className="btn-primary" onClick={handleSearch}>Найти</button>
                                </div>

                                <div>
                                    {foundPlayers.map(fp => (
                                        <div key={fp.id} className="search-result-item">
                                            <span>{fp.full_name} (Рейтинг: {fp.rating})</span>
                                            <button className="btn-success" onClick={() => addExistingPlayer(fp.id)}>Добавить</button>
                                        </div>
                                    ))}
                                </div>

                                <div className="divider"></div>

                                <h4 style={{ marginBottom: 15 }}>Или зарегистрировать нового:</h4>
                                <form onSubmit={handleCreateNewPlayer}>
                                    <input placeholder="ФИО" value={newPlayer.full_name} onChange={e => setNewPlayer({ ...newPlayer, full_name: e.target.value })} required />
                                    <input type="email" placeholder="Email (для входа)" value={newPlayer.email} onChange={e => setNewPlayer({ ...newPlayer, email: e.target.value })} required />
                                    <input type="number" placeholder="Возраст" value={newPlayer.age} onChange={e => setNewPlayer({ ...newPlayer, age: e.target.value })} required />
                                    <input type="number" placeholder="Рейтинг" value={newPlayer.rating} onChange={e => setNewPlayer({ ...newPlayer, rating: e.target.value })} required />
                                    <button type="submit" className="btn-primary" style={{ width: '100%' }}>Зарегистрировать и добавить</button>
                                </form>
                            </>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}
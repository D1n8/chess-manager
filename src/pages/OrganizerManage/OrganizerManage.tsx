import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../../supabaseClient'
import type { Participant, Match } from '../../types'

export default function OrganizerManage() {
    const { id } = useParams<{ id: string }>()
    const [participants, setParticipants] = useState<Participant[]>([])
    const [matches, setMatches] = useState<Match[]>([])
    const [activeTab, setActiveTab] = useState<'participants' | 'matches'>('participants')

    const fetchData = async (tournamentId: string) => {
        const { data: pData } = await supabase.from('participants').select('*').eq('tournament_id', tournamentId)
        const { data: mData } = await supabase.from('matches').select('*').eq('tournament_id', tournamentId)

        if (pData) setParticipants(pData as Participant[])
        if (mData) setMatches(mData as Match[])
    }

    useEffect(() => {
        if (id) fetchData(id)
    }, [id])


    const handleUpdateResult = async (matchId: string, result: string) => {
        await supabase.from('matches').update({ result }).eq('id', matchId)
        if (id) fetchData(id)
    }

    return (
        <div>
            <h1>Управление турниром</h1>
            <div>
                <button onClick={() => setActiveTab('participants')}>Участники</button>
                <button onClick={() => setActiveTab('matches')}>Жеребьевка и результаты</button>
            </div>

            {activeTab === 'participants' && (
                <div>
                    <h2>Список участников</h2>
                    <ul>
                        {participants.map(p => (
                            <li key={p.id}>Участник ID: {p.player_id}</li>
                        ))}
                    </ul>
                </div>
            )}

            {activeTab === 'matches' && (
                <div>
                    <h2>Результаты</h2>
                    <table>
                        <thead>
                            <tr>
                                <th>Белые</th>
                                <th>Черные</th>
                                <th>Ввод результата</th>
                            </tr>
                        </thead>
                        <tbody>
                            {matches.map(m => (
                                <tr key={m.id}>
                                    <td>{m.player_white}</td>
                                    <td>{m.player_black}</td>
                                    <td>
                                        <select
                                            value={m.result || ''}
                                            onChange={(e) => handleUpdateResult(m.id, e.target.value)}
                                        >
                                            <option value="">Ожидается</option>
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
        </div>
    )
}
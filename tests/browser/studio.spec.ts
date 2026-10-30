import {test,expect} from '@playwright/test';
test('cadastro, projeto vazio, autosave, restauração e interface mobile',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:'Ainda não tenho uma conta'}).click();
 await page.getByLabel('E-mail').fill(`browser-${crypto.randomUUID()}@example.com`);await page.getByLabel('Senha',{exact:true}).fill('strong-browser-password');await page.getByRole('button',{name:'Criar conta',exact:true}).click();
 await page.getByRole('button',{name:'Novo projeto',exact:true}).click();await page.getByLabel('Nome do projeto').fill('História de homologação');await page.getByRole('button',{name:'Criar projeto',exact:true}).click();
 await expect(page.getByLabel('Roteiro',{exact:true})).toHaveValue('');await page.getByLabel('Roteiro',{exact:true}).fill('A primeira luz atravessa a cidade.');await page.getByRole('button',{name:'Adicionar',exact:true}).click();await page.getByLabel('Título',{exact:true}).fill('Primeira luz');
 await expect(page.locator('.save-state')).toHaveText('Sincronizado');await page.reload();await expect(page.getByLabel('Roteiro',{exact:true})).toHaveValue('A primeira luz atravessa a cidade.');await expect(page.getByLabel('Título',{exact:true})).toHaveValue('Primeira luz');
 await expect(page.getByRole('button',{name:'Estimar custo de vídeo'})).toBeDisabled();await page.setViewportSize({width:390,height:844});await expect(page.getByRole('button',{name:'Aprovar cena',exact:true})).toBeDisabled();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 for(const viewport of [{width:320,height:640},{width:844,height:390},{width:1440,height:900}]){await page.setViewportSize(viewport);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)}
 await page.screenshot({path:'test-results/studio-desktop.png',fullPage:true});
 await page.getByRole('button',{name:'Voltar aos projetos'}).click();await expect(page.getByRole('heading',{name:'Meus projetos'})).toBeVisible();await page.getByRole('button',{name:'Início',exact:true}).click();await expect(page.getByRole('heading',{name:'Comece com uma tela em branco.'})).toBeVisible();await page.reload();await expect(page.getByRole('heading',{name:'Comece com uma tela em branco.'})).toBeVisible();
});
test('site web: custo e confirmação explícita antes de enviar vídeo (API simulada)',async({page})=>{
 let paidRequests=0;let sceneId="";let submitted=false;
 await page.route('**/api/video/provider',route=>route.fulfill({json:{state:'configured_unverified',model:'gen4.5',reason:'Provedor simulado para teste'}}));
 await page.route('**/api/video/jobs',async route=>{if(route.request().method()==='POST'){paidRequests++;submitted=true;await route.fulfill({status:202,json:{id:'mock',status:'PENDING'}})}else await route.fulfill({json:submitted?[{id:'mock-task',sceneId,status:'PENDING',mediaId:null,error:null}]:[]})});
 await page.route('**/api/video/jobs/*',route=>route.fulfill({json:{id:'mock-task',sceneId,status:'RUNNING',mediaId:null,error:null}}));
 await page.route('**/api/video/quotes',route=>{sceneId=route.request().postDataJSON().sceneId;return route.fulfill({json:{id:crypto.randomUUID(),credits:72,model:'gen4.5',input:{prompt:'Cena simulada',duration:6,ratio:'16:9'},notice:'Estimativa fictícia apenas no teste; nenhuma geração paga.'}})});
 await page.goto('/');await page.getByRole('button',{name:'Ainda não tenho uma conta'}).click();await page.getByLabel('E-mail').fill(`confirm-${crypto.randomUUID()}@example.com`);await page.getByLabel('Senha',{exact:true}).fill('strong-browser-password');await page.getByRole('button',{name:'Criar conta',exact:true}).click();
 await page.getByRole('button',{name:'Novo projeto',exact:true}).click();await page.getByLabel('Nome do projeto').fill('Site responsivo');await page.getByRole('button',{name:'Criar projeto',exact:true}).click();await page.getByRole('button',{name:'Adicionar',exact:true}).click();await expect(page.locator('.save-state')).toHaveText('Sincronizado');
 await page.getByRole('button',{name:'Estimar custo de vídeo'}).click();await expect(page.getByRole('dialog')).toBeVisible();expect(paidRequests).toBe(0);await expect(page.getByRole('button',{name:'Cancelar',exact:true})).toBeFocused();await page.keyboard.press('Shift+Tab');await expect(page.getByRole('button',{name:'Autorizar geração paga'})).toBeFocused();await expect(page.getByText('72 créditos estimados da API Runway')).toBeVisible();await page.getByRole('button',{name:'Cancelar',exact:true}).click();expect(paidRequests).toBe(0);
 await page.setViewportSize({width:390,height:844});await page.getByRole('button',{name:'Estimar custo de vídeo'}).click();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.getByRole('button',{name:'Autorizar geração paga'}).click();await expect(page.getByRole('dialog')).toHaveCount(0);expect(paidRequests).toBe(1);await expect(page.getByText('Gerando vídeo',{exact:true})).toBeVisible({timeout:15000});await page.reload();await expect(page.getByText('Gerando vídeo',{exact:true})).toBeVisible({timeout:15000});expect(paidRequests).toBe(1);
 await page.setViewportSize({width:1440,height:900});await page.getByRole('button',{name:'Ajustes',exact:true}).click();await expect(page.getByRole('heading',{name:'Acesso pelo navegador'})).toBeVisible();await expect(page.getByRole('link',{name:/APK|Aplicativo Android/})).toHaveCount(0);
});

test('interface privada esconde criação de conta',async({page})=>{await page.route('**/api/auth/config',r=>r.fulfill({json:{private:true,registrationEnabled:false}}));await page.goto('/');await expect(page.getByRole('button',{name:'Entrar no studio'})).toBeVisible();await expect(page.getByRole('button',{name:'Ainda não tenho uma conta'})).toHaveCount(0);await expect(page.getByText('Acesso privado. Solicite ao proprietário sua conta.')).toBeVisible();});

test('organização: rascunho, andamento, finalizado, histórico e segundo provedor',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:'Ainda não tenho uma conta'}).click();
 await page.getByLabel('E-mail').fill('organize-'+crypto.randomUUID()+'@example.com');
 await page.getByLabel('Senha',{exact:true}).fill('strong-browser-password');
 await page.getByRole('button',{name:'Criar conta',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Comece com uma tela em branco.'})).toBeVisible();
 await page.getByRole('button',{name:'Novo projeto',exact:true}).click();
 await page.getByLabel('Nome do projeto').fill('Filme da organização');
 await page.getByRole('button',{name:'Criar projeto',exact:true}).click();
 await expect(page.getByLabel('Status do projeto',{exact:true})).toHaveValue('draft');
 await page.getByLabel('Provedor de vídeo').selectOption('google_flow');
 await expect(page.getByRole('link',{name:/Abrir Google Flow/})).toBeVisible();
 await expect(page.getByRole('button',{name:'Abrir painel'})).toBeVisible();
 await page.getByLabel('Status do projeto',{exact:true}).selectOption('in_progress');
 await expect(page.locator('.save-state')).toHaveText('Sincronizado');
 await page.getByRole('button',{name:'Voltar aos projetos'}).click();
 await page.getByRole('button',{name:/^Em andamento/}).click();
 await expect(page.getByRole('button',{name:'Abrir projeto Filme da organização'})).toBeVisible();
 await page.getByLabel('Status do projeto Filme da organização').selectOption('completed');
 await page.getByRole('button',{name:/^Finalizados/}).click();
 await expect(page.getByText('Filme da organização')).toBeVisible();
 await page.getByRole('button',{name:'Histórico',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Histórico de projetos'})).toBeVisible();
 await expect(page.locator('.history-item').first()).toContainText('Filme da organização');
 await expect(page.locator('.history-item').first()).toContainText('Finalizado');
});
